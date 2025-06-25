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
    // Verificar que el entrenador exista
    const [entrenador] = await pool.query(
      `SELECT * FROM usuarios WHERE id = ? AND tipo = 'entrenador'`,
      [trainerId]
    );

    if (entrenador.length === 0) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    const [reviews] = await pool.query(
      `SELECT 
         c.calificacion, 
         c.comentario, 
         c.fecha_comentario,
         u.id AS user_id,
         u.nombre AS autor_nombre, 
         u.apellido AS autor_apellido, 
         u.foto_perfil AS profile_picture
       FROM comentarios c
       JOIN usuarios u ON c.cliente_id = u.id
       WHERE c.entrenador_id = ?`,
      [trainerId]
    );

    return res.json({
      reviews: reviews.map(r => ({
        user_id: r.user_id,
        rating: r.calificacion,
        comment: r.comentario,
        date: r.fecha_comentario,
        author_first_name: r.autor_nombre,
        author_last_name: r.autor_apellido,
        profile_picture: r.profile_picture
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
    // 1. Obtener IDs y nombres de servicios del entrenador
    const [services] = await pool.query(
      'SELECT id, nombre AS name FROM servicios WHERE entrenador_id = ?',
      [trainerId]
    );

    const serviceIds = services.map(s => s.id);
    const placeholders = serviceIds.map(() => '?').join(', ');

    // 2. Calificación promedio
    const [avgResult] = await pool.query(
      `SELECT AVG(calificacion) AS promedio
       FROM comentarios
       WHERE entrenador_id = ?`,
      [trainerId]
    );

    const average_rating = avgResult[0].promedio
      ? parseFloat(avgResult[0].promedio)
      : null;

    // 3. Total de reviews
    const [totalReviewsResult] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM comentarios
       WHERE entrenador_id = ?`,
      [trainerId]
    );

    const total_reviews = totalReviewsResult[0].total;

    // 4. Distribución de calificaciones
    const [distribution] = await pool.query(
      `SELECT calificacion, COUNT(*) AS cantidad
       FROM comentarios
       WHERE entrenador_id = ?
       GROUP BY calificacion`,
      [trainerId]
    );

    const rating_distribution = distribution.reduce((acc, row) => {
      acc[row.calificacion] = row.cantidad;
      return acc;
    }, {});

    // 5. Visualizaciones por servicio
    const [views] = serviceIds.length > 0
      ? await pool.query(
          `SELECT servicio_id, COUNT(*) AS visualizaciones
           FROM visualizaciones
           WHERE servicio_id IN (${placeholders})
           GROUP BY servicio_id`,
          serviceIds
        )
      : [[]];

    // 6. Contrataciones aceptadas por servicio
    const [contracts] = serviceIds.length > 0
      ? await pool.query(
          `SELECT servicio_id, COUNT(*) AS contrataciones
           FROM contrataciones
           WHERE estado IN ('aceptado', 'completado')
             AND servicio_id IN (${placeholders})
           GROUP BY servicio_id`,
          serviceIds
        )
      : [[]];

    // 7. Calcular conversiones por servicio
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

    // 8. Enviar respuesta
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
  const trainerId = parseInt(req.params.id, 10);
  const clientId = req.user.id;
  const { comment, rating } = req.body;

  // Basic validation
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
  }

  try {
    // 1. Check if the trainer exists and is of type "entrenador"
    const [trainerRows] = await pool.query(
      'SELECT * FROM usuarios WHERE id = ? AND tipo = "entrenador"',
      [trainerId]
    );
    if (trainerRows.length === 0) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    // 2. Check if the client has at least one valid contract with that trainer
    const [contracts] = await pool.query(
      `SELECT c.id
       FROM contrataciones c
       JOIN servicios s ON c.servicio_id = s.id
       WHERE c.cliente_id = ? AND s.entrenador_id = ? AND c.estado != 'pendiente'`,
      [clientId, trainerId]
    );
    if (contracts.length === 0) {
      return res.status(403).json({ message: 'You can only leave a review if you have hired this trainer' });
    }

    // 3. Check if the client already left a review for this trainer
    const [existing] = await pool.query(
      `SELECT * FROM comentarios WHERE cliente_id = ? AND entrenador_id = ?`,
      [clientId, trainerId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'You have already left a review for this trainer' });
    }

    // 4. Insert review
    await pool.query(
      `INSERT INTO comentarios (cliente_id, entrenador_id, comentario, calificacion)
       VALUES (?, ?, ?, ?)`,
      [clientId, trainerId, comment || '', rating]
    );

    return res.status(201).json({ message: 'Review submitted successfully' });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.obtenerServiciosDelEntrenador = async (req, res) => {
  const trainerId = parseInt(req.params.id);
  const user = req.user; // gracias a verificarTokenOpcional

  try {
    const isOwner = user && user.id === trainerId && user.tipo === 'entrenador';

    let query = `
      SELECT 
        s.id,
        s.nombre AS name,
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
        s.estado AS status,

        -- Highlight image
        (SELECT ruta FROM imagenes_servicio img WHERE img.servicio_id = s.id LIMIT 1) AS highlight_image,

        -- Trainer average rating
        (
          SELECT AVG(c.calificacion)
          FROM comentarios c
          WHERE c.entrenador_id = s.entrenador_id
        ) AS trainer_average_rating

      FROM servicios s
      JOIN categorias cat ON s.categoria_id = cat.id
      JOIN zonas z ON s.zona_id = z.id
      WHERE s.entrenador_id = ?
    `;

    const params = [trainerId];

    if (!isOwner) {
      query += ` AND s.estado = 'publicado'`;
    }

    const [services] = await pool.query(query, params);

    // Convertir trainer_average_rating a número con 2 decimales (o null)
    const formatted = services.map(service => ({
      ...service,
      trainer_average_rating: service.trainer_average_rating
        ? parseFloat(service.trainer_average_rating.toFixed(2))
        : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error getting trainer services:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.obtenerDiasOcupados = async (req, res) => {
  const trainerId = parseInt(req.params.id, 10);

  try {
    const [contrataciones] = await pool.query(`
      SELECT 
        con.fecha_inicio,
        con.hora_inicio,
        s.duracion_minutos,
        s.cantidad_sesiones
      FROM contrataciones con
      JOIN servicios s ON con.servicio_id = s.id
      WHERE s.entrenador_id = ? AND con.estado = 'aceptado'
    `, [trainerId]);

    const busySlots = [];

    for (const con of contrataciones) {
      if (!con.fecha_inicio || !con.hora_inicio) continue; // ⛔️ saltar contrataciones incompletas

      const startDate = new Date(con.fecha_inicio);
      const [hours, minutes] = con.hora_inicio.split(':').map(Number);
      const duration = con.duracion_minutos;
      const sessionCount = con.cantidad_sesiones;

      for (let i = 0; i < sessionCount; i++) {
        const sessionDate = new Date(startDate);
        sessionDate.setDate(startDate.getDate() + i * 7);

        const sessionStart = new Date(sessionDate);
        sessionStart.setHours(hours, minutes, 0, 0);

        const sessionEnd = new Date(sessionStart.getTime() + duration * 60000);

        busySlots.push({
          date: sessionDate.toISOString().split('T')[0],
          start_time: sessionStart.toTimeString().slice(0, 5),
          end_time: sessionEnd.toTimeString().slice(0, 5)
        });
      }
    }

    res.json(busySlots);
  } catch (error) {
    console.error('Error fetching busy days:', error);
    res.status(500).json({ message: 'Server error' });
  }
};