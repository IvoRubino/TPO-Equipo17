const pool = require('../config/db');

exports.obtenerPerfilEntrenador = async (req, res) => {
  const trainerId = parseInt(req.params.id, 10);

  try {
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

    return res.json({
      trainer: {
        id: trainer.id,
        first_name: trainer.nombre,
        last_name: trainer.apellido,
        description: trainer.descripcion,
        profile_picture: trainer.foto_perfil
      }
    });
  } catch (error) {
    console.error('Error al obtener perfil del entrenador:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.obtenerReviewsEntrenador = async (req, res) => {
  const trainerId = parseInt(req.params.id, 10);

  try {
    // Obtener los servicios del entrenador
    const [services] = await pool.query(
      `SELECT id FROM servicios WHERE entrenador_id = ?`,
      [trainerId]
    );

    const serviceIds = services.map(s => s.id);
    if (serviceIds.length === 0) {
      return res.json({ reviews: [] });
    }

    const [reviews] = await pool.query(
      `SELECT r.calificacion, r.comentario, r.fecha_comentario,
              u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       JOIN usuarios u ON r.cliente_id = u.id
       WHERE ct.servicio_id IN (?)`,
      [serviceIds]
    );

    return res.json({
      reviews: reviews.map(r => ({
        rating: r.calificacion,
        comment: r.comentario,
        date: r.fecha_comentario,
        author_first_name: r.autor_nombre,
        author_last_name: r.autor_apellido
      }))
    });
  } catch (error) {
    console.error('Error al obtener reviews del entrenador:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.obtenerEstadisticasEntrenador = async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const user = req.user;

  if (user.id !== trainerId || user.tipo !== 'entrenador') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    // Obtener IDs y nombres de servicios del entrenador
    const [services] = await pool.query(
      'SELECT id, nombre AS name FROM servicios WHERE entrenador_id = ?',
      [trainerId]
    );

    const serviceIds = services.map(s => s.id);
    if (serviceIds.length === 0) {
      return res.json({
        average_rating: null,
        total_reviews: 0,
        rating_distribution: {},
        conversions: []
      });
    }

    const placeholders = serviceIds.map(() => '?').join(', ');

    // Calificación promedio
    const [avgResult] = await pool.query(
      `SELECT AVG(r.calificacion) AS promedio
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       WHERE ct.servicio_id IN (${placeholders})`,
      serviceIds
    );

    const average_rating = avgResult[0].promedio
      ? parseFloat(avgResult[0].promedio)
      : null;

    // Cantidad total de reviews
    const [totalReviewsResult] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       WHERE ct.servicio_id IN (${placeholders})`,
      serviceIds
    );

    const total_reviews = totalReviewsResult[0].total;

    // Distribución de calificaciones
    const [distribution] = await pool.query(
      `SELECT r.calificacion, COUNT(*) AS cantidad
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       WHERE ct.servicio_id IN (${placeholders})
       GROUP BY r.calificacion`,
      serviceIds
    );

    const rating_distribution = distribution.reduce((acc, row) => {
      acc[row.calificacion] = row.cantidad;
      return acc;
    }, {});

    // Visualizaciones
    const [views] = await pool.query(
      `SELECT servicio_id, COUNT(*) AS visualizaciones
       FROM visualizaciones
       WHERE servicio_id IN (${placeholders})
       GROUP BY servicio_id`,
      serviceIds
    );

    // Contrataciones aceptadas
    const [contracts] = await pool.query(
      `SELECT servicio_id, COUNT(*) AS contrataciones
       FROM contrataciones
       WHERE estado IN ('aceptado', 'completado')
         AND servicio_id IN (${placeholders})
       GROUP BY servicio_id`,
      serviceIds
    );

    // Armar lista de conversiones
    const conversions = serviceIds.map(id => {
      const serviceViews = views.find(v => v.servicio_id === id)?.visualizaciones || 0;
      const serviceContracts = contracts.find(c => c.servicio_id === id)?.contrataciones || 0;
      const rate = serviceViews > 0
        ? Number(((serviceContracts / serviceViews) * 100).toFixed(2))
        : 0;
      const name = services.find(s => s.id === id)?.name || 'Unnamed Service';

      return {
        service_id: id,
        name,
        views: serviceViews,
        contracts: serviceContracts,
        conversion_rate: rate
      };
    });

    res.json({
      average_rating,
      total_reviews,
      rating_distribution,
      conversions
    });
  } catch (error) {
    console.error('Error al obtener estadísticas del entrenador:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//solo el entrenador puede editar su perfil, permitiendo cambiar la foto de perfil y la descripcion
exports.editarPerfilEntrenador = async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
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
  if (!description && !file) {
    return res.status(400).json({ message: 'No fields provided for update' });
  }

  try {
    const fields = [];
    const values = [];

    // Actualizar descripción si se envió
    if (description) {
      fields.push('descripcion = ?');
      values.push(description);
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
       WHERE c.cliente_id = ? AND s.entrenador_id = ? AND c.estado != 'pendiente'`,
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
  const user = req.user; // gracias a verificarTokenOpcional

  try {
    // Si está autenticado y es el mismo entrenador → mostrar todo
    const isOwner = user && user.id === trainerId && user.tipo === 'entrenador';

    let query = `
      SELECT 
        s.id,
        cat.nombre AS category,
        s.descripcion AS description,
        s.duracion_minutos AS duration_minutes,
        s.cantidad_sesiones AS session_count,
        s.modalidad AS mode,
        z.nombre AS zone,
        s.direccion AS address,
        s.horario_inicio AS start_time,
        s.horario_fin AS end_time,
        s.precio AS price,
        s.estado AS status
      FROM servicios s
      JOIN categorias cat ON s.categoria_id = cat.id
      JOIN zonas z ON s.zona_id = z.id
      WHERE s.entrenador_id = ?
    `;

    const params = [trainerId];

    // Si no es el dueño, filtrar solo servicios publicados
    if (!isOwner) {
      query += ` AND s.estado = 'publicado'`;
    }

    const [services] = await pool.query(query, params);
    res.json(services);
  } catch (error) {
    console.error('Error getting trainer services:', error);
    res.status(500).json({ message: 'Server error' });
  }
};