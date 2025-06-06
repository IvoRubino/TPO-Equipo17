const pool = require('../config/db');




exports.obtenerPerfilEntrenador = async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const user = req.user; // gracias al middleware verificarTokenOpcional

  try {
    // 1. Obtener datos básicos del entrenador
    const [trainers] = await pool.query(
      `SELECT id, nombre, apellido, descripcion, foto_perfil
       FROM usuarios
       WHERE id = ? AND tipo = 'entrenador'`,
      [trainerId]
    );

    if (trainers.length === 0) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    const trainer = trainers[0];
    const isOwner = user?.id === trainerId && user.tipo === 'entrenador';

    // 2. Obtener servicios del entrenador
    const [services] = await pool.query(
      `SELECT s.id, c.nombre AS categoria, z.nombre AS zona,
              s.descripcion, s.duracion_minutos, s.cantidad_sesiones,
              s.modalidad, s.direccion, s.precio, s.estado,
              s.horario_inicio, s.horario_fin
       FROM servicios s
       JOIN categorias c ON s.categoria_id = c.id
       JOIN zonas z ON s.zona_id = z.id
       WHERE s.entrenador_id = ?`,
      [trainerId]
    );

    const filteredServices = isOwner
      ? services
      : services.filter(s => s.estado === 'publicado');

    const serviceIds = services.map(s => s.id);
    const idsForStats = serviceIds.length ? [serviceIds] : [[-1]]; // evita error con IN () vacío

    // 3. Obtener reviews
    const [reviews] = await pool.query(
      `SELECT r.calificacion, r.comentario, r.fecha_comentario,
              u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       JOIN usuarios u ON r.cliente_id = u.id
       WHERE ct.servicio_id IN (?)`,
      idsForStats
    );

    // 4. Promedio de calificaciones
    const [avgResult] = await pool.query(
      `SELECT AVG(r.calificacion) AS promedio
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       WHERE ct.servicio_id IN (?)`,
      idsForStats
    );

    const averageRating = avgResult[0].promedio
      ? parseFloat(avgResult[0].promedio).toFixed(2)
      : null;

    // 5. Estadísticas privadas si es el dueño
    let statistics = null;

    if (isOwner && serviceIds.length > 0) {
      const [views] = await pool.query(
        `SELECT servicio_id, COUNT(*) AS visualizaciones
         FROM visualizaciones
         WHERE servicio_id IN (?)
         GROUP BY servicio_id`,
        [serviceIds]
      );

      const [contracts] = await pool.query(
        `SELECT servicio_id, COUNT(*) AS contrataciones
         FROM contrataciones
         WHERE estado = 'aceptado' AND servicio_id IN (?)
         GROUP BY servicio_id`,
        [serviceIds]
      );

      const [distribution] = await pool.query(
        `SELECT r.calificacion, COUNT(*) AS cantidad
         FROM comentarios r
         JOIN contrataciones ct ON r.contratacion_id = ct.id
         WHERE ct.servicio_id IN (?)
         GROUP BY r.calificacion`,
        [serviceIds]
      );

      const totalRatings = reviews.length;

      const conversions = services.map(service => {
        const serviceViews = views.find(v => v.servicio_id === service.id)?.visualizaciones || 0;
        const serviceContracts = contracts.find(c => c.servicio_id === service.id)?.contrataciones || 0;
        const rate = serviceViews > 0 ? ((serviceContracts / serviceViews) * 100).toFixed(2) : '0.00';

        return {
          service_id: service.id,
          views: serviceViews,
          contracts: serviceContracts,
          conversion_rate: `${rate}%`
        };
      });

      statistics = {
        conversions,
        average_rating: averageRating,
        total_reviews: totalRatings,
        rating_distribution: distribution.reduce((acc, curr) => {
          acc[curr.calificacion] = curr.cantidad;
          return acc;
        }, {})
      };
    }

    // 6. Respuesta final
    return res.json({
      trainer: {
        id: trainer.id,
        first_name: trainer.nombre,
        last_name: trainer.apellido,
        description: trainer.descripcion,
        profile_picture: trainer.foto_perfil
      },
      services: filteredServices.map(s => ({
        id: s.id,
        category: s.categoria,
        area: s.zona,
        description: s.descripcion,
        duration_minutes: s.duracion_minutos,
        session_count: s.cantidad_sesiones,
        modality: s.modalidad,
        address: s.direccion,
        price: s.precio,
        status: s.estado,
        start_time: s.horario_inicio,
        end_time: s.horario_fin
      })),
      reviews: reviews.map(r => ({
        rating: r.calificacion,
        comment: r.comentario,
        date: r.fecha_comentario,
        author_first_name: r.autor_nombre,
        author_last_name: r.autor_apellido
      })),
      average_rating: averageRating,
      ...(statistics && { statistics })
    });
  } catch (error) {
    console.error('Error al obtener perfil del entrenador:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//solo el entrenador puede editar su perfil, permitiendo cambiar la foto de perfil y la descripcion
exports.editarPerfilEntrenador = async (req, res) => {
  const { id } = req.params;
  const { descripcion } = req.body;
  const file = req.file;

  // Verificar si el usuario existe
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
  if (rows.length === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Asegurarse de que el usuario autenticado está editando su propio perfil
  if (parseInt(id) !== req.user.id) {
    return res.status(403).json({ message: 'You do not have permission to edit this profile' });
  }

  // Verificar que sea un entrenador
  if (req.user.tipo !== 'entrenador') {
    return res.status(403).json({ message: 'Only trainers can edit their profile' });
  }

  // Verificar si se enviaron datos para actualizar
  if (!descripcion && !file) {
    return res.status(400).json({ message: 'No fields provided for update' });
  }

  try {
    const fields = [];
    const values = [];

    // Actualizar descripción si se envió
    if (descripcion) {
      fields.push('descripcion = ?');
      values.push(descripcion);
    }

    // Actualizar foto de perfil si se subió un archivo
    if (file) {
      const photoPath = `/uploads/profile-pictures/${file.filename}`;
      fields.push('foto_perfil = ?');
      values.push(photoPath);
    }

    values.push(id);

    const sql = `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`;
    await pool.query(sql, values);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//cliente comenta a entrenador
exports.comentarEntrenador = async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const clientId = req.user.id;
  const { comentario, calificacion } = req.body;

  // Validar los datos recibidos
  if (!Number.isInteger(trainerId) || !calificacion) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  if (calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    // Verificar que el entrenador exista
    const [trainer] = await pool.query(
      'SELECT * FROM usuarios WHERE id = ? AND tipo = "entrenador"',
      [trainerId]
    );
    if (trainer.length === 0) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    // Verificar que haya una contratacion aceptada con un servicio del entrenador
    const [contract] = await pool.query(
      `SELECT c.*
       FROM contrataciones c
       JOIN servicios s ON c.servicio_id = s.id
       WHERE c.cliente_id = ? AND s.entrenador_id = ? AND c.estado = 'aceptada'`,
      [clientId, trainerId]
    );
    if (contract.length === 0) {
      return res.status(403).json({ message: 'You can only leave a review if you have hired this trainer' });
    }

    // Verificar si ya dejo una review
    const [existing] = await pool.query(
      'SELECT * FROM comentarios WHERE cliente_id = ? AND entrenador_id = ?',
      [clientId, trainerId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'You have already left a review for this trainer' });
    }

    // Insertar la review
    await pool.query(
      `INSERT INTO comentarios (cliente_id, entrenador_id, comentario, calificacion, fecha)
       VALUES (?, ?, ?, ?, NOW())`,
      [clientId, trainerId, comentario || '', calificacion]
    );

    res.status(201).json({ message: 'Review submitted successfully' });
  } catch (error) {
    console.error('Error reviewing trainer:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.obtenerServiciosDelEntrenador = async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const user = req.user;

  try {
    // Verify that the user is the owner
    if (user.id !== trainerId || user.tipo !== 'entrenador') {
      return res.status(403).json({ message: 'You do not have permission to view these services' });
    }

    const [services] = await pool.query(
      `SELECT id, categoria AS category, descripcion AS description, duracion_minutos AS duration_minutes,
              cantidad_sesiones AS session_count, modalidad AS mode, zona AS zone, direccion AS address,
              horario_inicio AS start_time, horario_fin AS end_time, precio AS price, estado AS status
       FROM servicios
       WHERE entrenador_id = ?`,
      [trainerId]
    );

    res.json(services);
  } catch (error) {
    console.error('Error getting trainer services:', error);
    res.status(500).json({ message: 'Server error' });
  }
};