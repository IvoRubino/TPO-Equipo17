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
    limit,
    category
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

    if (category) {
      filters.push('cat.nombre = ?');
      values.push(category);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const sql = `
      SELECT 
        s.id, s.nombre AS name, s.descripcion AS description, s.precio AS price, 
        s.duracion_minutos AS duration_minutes, s.cantidad_sesiones AS session_count,
        s.modalidad AS mode, s.horario_inicio AS start_time, s.horario_fin AS end_time,
        z.nombre AS zone,
        cat.nombre AS category,
        u.id AS trainer_id, u.nombre AS trainer_first_name, u.apellido AS trainer_last_name, u.foto_perfil AS trainer_profile_picture,

        -- Imagen destacada
        (SELECT ruta FROM imagenes_servicio img WHERE img.servicio_id = s.id LIMIT 1) AS highlight_image,

        -- Calificación promedio del entrenador (nuevo modelo)
        IFNULL((
          SELECT AVG(c.calificacion)
          FROM comentarios c
          WHERE c.entrenador_id = u.id
        ), 0) AS trainer_average_rating

      FROM servicios s
      JOIN categorias cat ON s.categoria_id = cat.id
      JOIN zonas z ON s.zona_id = z.id
      JOIN usuarios u ON s.entrenador_id = u.id
      ${whereClause}
      ORDER BY trainer_average_rating DESC
      ${limit ? 'LIMIT ?' : ''}
    `;

    if (limit) values.push(parseInt(limit));

    const [services] = await pool.query(sql, values);

    const filtered = rating
      ? services.filter(s => parseFloat(s.trainer_average_rating) >= parseFloat(rating))
      : services;

    res.json(filtered);
  } catch (error) {
    console.error('Error filtering services:', error);
    res.status(500).json({ message: 'Error filtering services' });
  }
};

exports.obtenerServicioPorId = async (req, res) => {
  const serviceId = parseInt(req.params.id);

  try {
    // 1. Obtener datos del servicio
    const [result] = await pool.query(
      `SELECT s.id, s.nombre AS name, s.descripcion, s.modalidad, s.direccion, s.precio,
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

    // 2. Registrar visualización
    await pool.query('INSERT INTO visualizaciones (servicio_id) VALUES (?)', [serviceId]);

    // 3. Obtener imágenes
    const [images] = await pool.query(
      `SELECT ruta FROM imagenes_servicio WHERE servicio_id = ?`,
      [serviceId]
    );

    // 4. Días disponibles
    const [days] = await pool.query(
      `SELECT dia FROM dias_servicio WHERE servicio_id = ?`,
      [serviceId]
    );

    // 5. Obtener promedio de calificaciones del entrenador
    const [averageResult] = await pool.query(
      `SELECT AVG(calificacion) AS promedio
       FROM comentarios
       WHERE entrenador_id = ?`,
      [servicio.entrenador_id]
    );

    const average_rating = averageResult[0].promedio
      ? parseFloat(averageResult[0].promedio).toFixed(2)
      : null;

    // 6. Obtener reviews del entrenador
    const [reviews] = await pool.query(
      `SELECT c.calificacion, c.comentario, c.fecha_comentario,
              u.nombre AS autor_nombre, u.apellido AS autor_apellido, u.foto_perfil AS autor_foto
       FROM comentarios c
       JOIN usuarios u ON c.cliente_id = u.id
       WHERE c.entrenador_id = ?`,
      [servicio.entrenador_id]
    );

    // 7. Enviar respuesta
    res.json({
      id: servicio.id,
      name: servicio.name,
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
        average_rating,
        reviews: reviews.map(r => ({
          rating: r.calificacion,
          comment: r.comentario,
          date: r.fecha_comentario,
          author_first_name: r.autor_nombre,
          author_last_name: r.autor_apellido,
          author_picture: r.autor_foto
        }))
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
    name,
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

  if (!name || !category || !description || !duration_minutes || !session_count || !price || !mode || !days) {
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
  const selectedDaysRaw = Array.isArray(days) ? days : [days];
  const selectedDays = selectedDaysRaw.filter((d) => validDays.includes(d));

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
       (entrenador_id, categoria_id, nombre, descripcion, duracion_minutos, cantidad_sesiones, precio, modalidad, zona_id, direccion, horario_inicio, horario_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trainer_id,
        category_id,
        name,
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
  const service_id = req.params.id;
  const {
    name,
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

  // Validaciones básicas
  if (!name || !category || !description || !duration_minutes || !session_count || !price || !modality || !days) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!['virtual', 'in-person'].includes(modality)) {
    return res.status(400).json({ message: 'Modality must be "virtual" or "in-person"' });
  }

  if (modality === 'in-person' && (!address || !zone)) {
    return res.status(400).json({ message: 'Zone and address are required for in-person modality' });
  }

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

  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const filteredDays = Array.isArray(days) ? days.filter((d) => validDays.includes(d)) : [];

  if (filteredDays.length === 0) {
    return res.status(400).json({ message: 'You must select at least one valid day' });
  }

  try {
    // Verificamos que el servicio exista y sea del entrenador
    const [existingService] = await pool.query(
      'SELECT * FROM services WHERE id = ? AND trainer_id = ?',
      [service_id, trainer_id]
    );
    if (existingService.length === 0) {
      return res.status(404).json({ message: 'Service not found or unauthorized' });
    }

    // Obtener ID de categoría
    const [catResult] = await pool.query('SELECT id FROM categories WHERE name = ?', [category]);
    if (catResult.length === 0) {
      return res.status(400).json({ message: 'Category does not exist' });
    }
    const category_id = catResult[0].id;

    // Obtener zona
    let zone_id;
    if (modality === 'virtual') {
      const [virtualZone] = await pool.query('SELECT id FROM zones WHERE name = "virtual"');
      zone_id = virtualZone.length > 0 ? virtualZone[0].id : null;
    } else {
      const [zoneResult] = await pool.query('SELECT id FROM zones WHERE name = ?', [zone]);
      if (zoneResult.length === 0) {
        return res.status(400).json({ message: 'Zone does not exist' });
      }
      zone_id = zoneResult[0].id;
    }

    const finalAddress = modality === 'virtual' ? 'virtual' : address;

    // Actualizar el servicio
    await pool.query(
      `UPDATE services SET 
        name = ?, category_id = ?, description = ?, duration_minutes = ?, 
        session_count = ?, price = ?, modality = ?, zone_id = ?, 
        address = ?, start_time = ?, end_time = ?
       WHERE id = ? AND trainer_id = ?`,
      [
        name,
        category_id,
        description,
        duration_minutes,
        session_count,
        price,
        modality,
        zone_id,
        finalAddress,
        start_time,
        end_time,
        service_id,
        trainer_id
      ]
    );

    // Borrar y volver a insertar los días
    await pool.query('DELETE FROM service_days WHERE service_id = ?', [service_id]);
    const dayInserts = filteredDays.map((day) =>
      pool.query('INSERT INTO service_days (service_id, day) VALUES (?, ?)', [service_id, day])
    );
    await Promise.all(dayInserts);

    // Si se mandan nuevas imágenes, borrar las viejas y subir nuevas
    const images = req.files || [];
    if (images.length > 0) {
      if (images.length > 4) {
        return res.status(400).json({ message: 'Only up to 4 images per service are allowed' });
      }

      await pool.query('DELETE FROM service_images WHERE service_id = ?', [service_id]);

      const imageInserts = images.map((img) =>
        pool.query(
          'INSERT INTO service_images (service_id, name, path) VALUES (?, ?, ?)',
          [service_id, img.originalname, `/uploads/service-images/${img.filename}`]
        )
      );
      await Promise.all(imageInserts);
    }

    res.status(200).json({ message: 'Service updated successfully' });
  } catch (error) {
    console.error('Error updating service:', error);
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