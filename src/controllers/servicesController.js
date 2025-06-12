const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

exports.getServiciosConFiltros = async (req, res) => {
  const {
    minPrice,
    maxPrice,
    rating,
    mode,
    duration,
    zone,
    limit
  } = req.query;

  try {
    const filters = [];
    const values = [];

    filters.push('s.estado = "publicado"');

    if (minPrice) {
      filters.push('s.precio >= ?');
      values.push(minPrice);
    }

    if (maxPrice) {
      filters.push('s.precio <= ?');
      values.push(maxPrice);
    }

    if (mode) {
      filters.push('s.modalidad = ?');
      values.push(mode);
    }

    if (duration) {
      filters.push('s.duracion_minutos <= ?');
      values.push(duration);
    }

    if (zone && mode !== 'virtual') {
      filters.push('z.nombre = ?');
      values.push(zone);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const sql = `
      SELECT 
        s.id, s.descripcion AS description, s.precio AS price, 
        s.duracion_minutos AS duration_minutes, s.cantidad_sesiones AS session_count,
        s.modalidad AS mode, s.horario_inicio AS start_time, s.horario_fin AS end_time,
        z.nombre AS zone,
        cat.nombre AS category,
        u.id AS trainer_id, u.nombre AS trainer_first_name, u.apellido AS trainer_last_name, u.foto_perfil AS trainer_profile_picture,

        -- Highlight image
        (SELECT ruta FROM imagenes_servicio img WHERE img.servicio_id = s.id LIMIT 1) AS highlight_image,

        -- Trainer average rating (0 if none)
        IFNULL((
          SELECT AVG(c.calificacion)
          FROM comentarios c
          JOIN contrataciones ct ON c.contratacion_id = ct.id
          JOIN servicios sv ON ct.servicio_id = sv.id
          WHERE sv.entrenador_id = s.entrenador_id
        ), 0) AS trainer_average_rating

      FROM servicios s
      JOIN categorias cat ON s.categoria_id = cat.id
      JOIN zonas z ON s.zona_id = z.id
      JOIN usuarios u ON s.entrenador_id = u.id
      ${whereClause}
      ${rating ? 'HAVING trainer_average_rating >= ?' : ''}
      ORDER BY trainer_average_rating DESC
      ${limit ? 'LIMIT ?' : ''}
    `;

    if (rating) values.push(parseFloat(rating));
    if (limit) values.push(parseInt(limit));

    const [services] = await pool.query(sql, values);
    res.json(services);
  } catch (error) {
    console.error('Error fetching filtered services:', error);
    res.status(500).json({ message: 'Error filtering services' });
  }
};


//obtiene datos relevantes del servicio por Id
exports.obtenerServicioPorId = async (req, res) => {
  const serviceId = parseInt(req.params.id);

  try {
    // 1. Get service data
    const [result] = await pool.query(
      `SELECT s.id, s.descripcion, s.modalidad, s.direccion, s.precio,
              s.horario_inicio, s.horario_fin, s.duracion_minutos, s.cantidad_sesiones,
              c.nombre AS categoria, z.nombre AS zona,
              u.id AS entrenador_id, u.nombre AS entrenador_nombre, u.apellido AS entrenador_apellido, u.foto_perfil
       FROM servicios s
       JOIN categorias c ON s.categoria_id = c.id
       JOIN zonas z ON s.zona_id = z.id
       JOIN usuarios u ON s.entrenador_id = u.id
       WHERE s.id = ? AND s.estado = 'publicado'`,
      [serviceId]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: 'Service not found or not published' });
    }

    const servicio = result[0];

    // 2. Inserta visualizaciones
    await pool.query('INSERT INTO visualizaciones (servicio_id) VALUES (?)', [serviceId]);

    // 3. Saca las imagenes
    const [images] = await pool.query(
      `SELECT ruta FROM imagenes_servicio WHERE servicio_id = ?`,
      [serviceId]
    );

    // 4. Dias disponibles
    const [days] = await pool.query(
      `SELECT dia FROM dias_servicio WHERE servicio_id = ?`,
      [serviceId]
    );

    // 5. Saca el promedio del rating
    const [averageResult] = await pool.query(
      `SELECT AVG(com.calificacion) AS promedio
       FROM comentarios com
       JOIN contrataciones ct ON com.contratacion_id = ct.id
       JOIN servicios s ON ct.servicio_id = s.id
       WHERE s.entrenador_id = ?`,
      [servicio.entrenador_id]
    );

    const average_rating = averageResult[0].promedio
      ? parseFloat(averageResult[0].promedio).toFixed(2)
      : null;

    // 6. Enviar respuesta
    res.json({
      id: servicio.id,
      description: servicio.descripcion,
      category: servicio.categoria,
      zone: servicio.zona,
      mode: servicio.modalidad,
      address: servicio.direccion,
      price: servicio.precio,
      duration_minutes: servicio.duracion_minutos,
      session_count: servicio.cantidad_sesiones,
      schedule_start: servicio.horario_inicio,
      schedule_end: servicio.horario_fin,
      available_days: days.map(d => d.dia),
      images: images.map(img => img.ruta),
      trainer: {
        id: servicio.entrenador_id,
        first_name: servicio.entrenador_nombre,
        last_name: servicio.entrenador_apellido,
        profile_picture: servicio.foto_perfil,
        average_rating
      }
    });
  } catch (error) {
    console.error('Error getting service:', error);
    res.status(500).json({ message: 'Error retrieving the service' });
  }
};


//ACTUALIZAR PARA IMAGENES Y ZONA NO SEA NULL CUANDO SE CREA UN SERVICIO VIRTUAL (ya deberia estar actualizado...!)
exports.crearServicio = async (req, res) => {
  const trainer_id = req.user.id;
  const {
    category,
    description,
    duration_minutes,
    session_count,
    price,
    mode,
    zone,
    address,
    days,
    start_time,
    end_time
  } = req.body;

  if (!category || !description || !duration_minutes || !session_count || !price || !mode || !days) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!['virtual', 'presencial'].includes(mode)) {
    return res.status(400).json({ message: 'Mode must be either "virtual" or "presencial"' });
  }

  if (mode === 'presencial' && (!address || !zone)) {
    return res.status(400).json({ message: 'Zone and address are required for presencial mode' });
  }

  if (!start_time || !end_time) {
    return res.status(400).json({ message: 'Start and end time are required' });
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
    return res.status(400).json({ message: 'Time must be in HH:MM format (e.g., 09:30)' });
  }

  if (start_time >= end_time) {
    return res.status(400).json({ message: 'Start time must be before end time' });
  }

  const validDays = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const selectedDays = Array.isArray(days) ? days.filter((d) => validDays.includes(d)) : [];

  if (selectedDays.length === 0) {
    return res.status(400).json({ message: 'At least one valid day is required' });
  }

  try {
    const [categoryResult] = await pool.query('SELECT id FROM categorias WHERE nombre = ?', [category]);
    if (categoryResult.length === 0) {
      return res.status(400).json({ message: 'Category not found' });
    }
    const category_id = categoryResult[0].id;

    let zone_id;
    if (mode === 'virtual') {
      const [virtualZone] = await pool.query('SELECT id FROM zonas WHERE nombre = "virtual"');
      zone_id = virtualZone.length > 0 ? virtualZone[0].id : null;
    } else {
      const [zoneResult] = await pool.query('SELECT id FROM zonas WHERE nombre = ?', [zone]);
      if (zoneResult.length === 0) {
        return res.status(400).json({ message: 'Zone not found' });
      }
      zone_id = zoneResult[0].id;
    }

    const finalAddress = mode === 'virtual' ? 'virtual' : address;

    const [result] = await pool.query(
      `INSERT INTO servicios 
       (entrenador_id, categoria_id, descripcion, duracion_minutos, cantidad_sesiones, precio, modalidad, zona_id, direccion, horario_inicio, horario_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trainer_id,
        category_id,
        description,
        duration_minutes,
        session_count,
        price,
        mode,
        zone_id,
        finalAddress,
        start_time,
        end_time
      ]
    );

    const service_id = result.insertId;

    const dayInserts = selectedDays.map((day) =>
      pool.query('INSERT INTO dias_servicio (servicio_id, dia) VALUES (?, ?)', [service_id, day])
    );
    await Promise.all(dayInserts);

    const images = req.files || [];
    if (images.length > 4) {
      return res.status(400).json({ message: 'You can only upload up to 4 images per service' });
    }

    const imageInserts = images.map((img) =>
      pool.query(
        'INSERT INTO imagenes_servicio (servicio_id, nombre, ruta) VALUES (?, ?, ?)',
        [service_id, img.originalname, `/uploads/service-images/${img.filename}`]
      )
    );
    await Promise.all(imageInserts);

    res.status(201).json({ message: 'Service created successfully' });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//actualiza servicio (es un PUT)
exports.actualizarServicio = async (req, res) => {
  const trainer_id = req.user.id;
  const {
    category,
    description,
    duration_minutes,
    session_count,
    price,
    modality,
    zone,
    address,
    days,
    start_time,
    end_time
  } = req.body;

  // Basic validation
  if (!category || !description || !duration_minutes || !session_count || !price || !modality || !days) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!['virtual', 'in-person'].includes(modality)) {
    return res.status(400).json({ message: 'Modality must be "virtual" or "in-person"' });
  }

  if (modality === 'in-person' && (!address || !zone)) {
    return res.status(400).json({ message: 'Zone and address are required for in-person modality' });
  }

  // Time validation
  if (!start_time || !end_time) {
    return res.status(400).json({ message: 'Start and end times are required' });
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
    return res.status(400).json({ message: 'Time must be in HH:MM format (e.g., 09:30)' });
  }

  if (start_time >= end_time) {
    return res.status(400).json({ message: 'Start time must be before end time' });
  }

  // Day validation
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const filteredDays = Array.isArray(days)
    ? days.filter((d) => validDays.includes(d))
    : [];

  if (filteredDays.length === 0) {
    return res.status(400).json({ message: 'You must select at least one valid day' });
  }

  try {
    // Get category ID
    const [catResult] = await pool.query(
      'SELECT id FROM categories WHERE name = ?',
      [category]
    );
    if (catResult.length === 0) {
      return res.status(400).json({ message: 'Category does not exist' });
    }
    const category_id = catResult[0].id;

    // Get zone ID
    let zone_id;
    if (modality === 'virtual') {
      const [virtualZone] = await pool.query('SELECT id FROM zones WHERE name = "virtual"');
      zone_id = virtualZone.length > 0 ? virtualZone[0].id : null;
    } else {
      const [zoneResult] = await pool.query(
        'SELECT id FROM zones WHERE name = ?',
        [zone]
      );
      if (zoneResult.length === 0) {
        return res.status(400).json({ message: 'Zone does not exist' });
      }
      zone_id = zoneResult[0].id;
    }

    const finalAddress = modality === 'virtual' ? 'virtual' : address;

    // Insert service
    const [result] = await pool.query(
      `INSERT INTO services 
       (trainer_id, category_id, description, duration_minutes, session_count, price, modality, zone_id, address, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trainer_id,
        category_id,
        description,
        duration_minutes,
        session_count,
        price,
        modality,
        zone_id,
        finalAddress,
        start_time,
        end_time
      ]
    );

    const service_id = result.insertId;

    // Insert available days
    const dayInserts = filteredDays.map((day) =>
      pool.query(
        'INSERT INTO service_days (service_id, day) VALUES (?, ?)',
        [service_id, day]
      )
    );
    await Promise.all(dayInserts);

    // Upload images (max 4)
    const images = req.files || [];
    if (images.length > 4) {
      return res.status(400).json({ message: 'Only up to 4 images per service are allowed' });
    }

    const imageInserts = images.map((img) =>
      pool.query(
        'INSERT INTO service_images (service_id, name, path) VALUES (?, ?, ?)',
        [service_id, img.originalname, `/uploads/service-images/${img.filename}`]
      )
    );
    await Promise.all(imageInserts);

    res.status(201).json({ message: 'Service created successfully' });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//elimina servicio
exports.eliminarServicio = async (req, res) => {
  const serviceId = req.params.id;
  const trainerId = req.user.id;

  try {
    // Verify that the service exists and belongs to the trainer
    const [services] = await pool.query(
      'SELECT * FROM servicios WHERE id = ? AND entrenador_id = ?',
      [serviceId, trainerId]
    );

    if (services.length === 0) {
      return res.status(404).json({ message: 'Service not found or does not belong to you' });
    }

    // Delete the service
    await pool.query('DELETE FROM servicios WHERE id = ?', [serviceId]);

    res.json({ message: 'Service successfully deleted' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.cambiarEstadoServicio = async (req, res) => {
  const serviceId = req.params.id;
  const trainerId = req.user.id;
  const { status } = req.body;

  if (!['publicado', 'despublicado', 'no_publicado'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    // Verify that the service exists and belongs to the trainer
    const [services] = await pool.query(
      'SELECT * FROM servicios WHERE id = ? AND entrenador_id = ?',
      [serviceId, trainerId]
    );

    if (services.length === 0) {
      return res.status(404).json({ message: 'Service not found or does not belong to you' });
    }

    // Update the status
    await pool.query(
      'UPDATE servicios SET estado = ? WHERE id = ?',
      [status, serviceId]
    );

    res.json({ message: `Service ${status === 'publicado' ? 'published' : 'unpublished'} successfully` });
  } catch (error) {
    console.error('Error changing service status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};