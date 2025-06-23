const pool = require('../config/db');

exports.obtenerMejoresComentarios = async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;

  try {
    const [reviews] = await pool.query(
      `SELECT 
         u.foto_perfil as profile_picture,
         u.nombre AS first_name,
         u.apellido AS last_name,
         c.calificacion AS rating,
         c.comentario AS comment,
       FROM comentarios c
       JOIN usuarios u ON c.cliente_id = u.id
       ORDER BY c.calificacion DESC, c.fecha_comentario DESC
       LIMIT ?`,
      [limit]
    );

    res.json(reviews);
  } catch (error) {
    console.error('Error al obtener reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
};