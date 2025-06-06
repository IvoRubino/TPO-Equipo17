const pool = require('../config/db');


exports.obtenerPerfilEntrenador = async (req, res) => {
  const entrenadorId = parseInt(req.params.id);
  const usuario = req.user;

  try {
    // 1. Obtener datos básicos del entrenador
    const [entrenadores] = await pool.query(
      `SELECT id, nombre, apellido, descripcion, foto_perfil
       FROM usuarios
       WHERE id = ? AND tipo = 'entrenador'`,
      [entrenadorId]
    );

    if (entrenadores.length === 0) {
      return res.status(404).json({ message: 'Entrenador no encontrado' });
    }

    const entrenador = entrenadores[0];
    const esPropietario = usuario?.id === entrenadorId && usuario.tipo === 'entrenador';

    // 2. Obtener servicios del entrenador
    const [servicios] = await pool.query(
      `SELECT s.id, c.nombre AS categoria, z.nombre AS zona,
              s.descripcion, s.duracion_minutos, s.cantidad_sesiones,
              s.modalidad, s.direccion, s.precio, s.estado,
              s.horario_inicio, s.horario_fin
       FROM servicios s
       JOIN categorias c ON s.categoria_id = c.id
       JOIN zonas z ON s.zona_id = z.id
       WHERE s.entrenador_id = ?`,
      [entrenadorId]
    );

    // Solo mostrar servicios publicados si no es el dueño
    const serviciosPublicos = esPropietario
      ? servicios
      : servicios.filter(s => s.estado === 'publicado');

    const servicioIds = servicios.map(s => s.id);

    // 3. Si no es el dueño → registrar visualizaciones
    if (!esPropietario && servicioIds.length > 0) {
      for (const id of servicioIds) {
        await pool.query('INSERT INTO visualizaciones (servicio_id) VALUES (?)', [id]);
      }
    }

    // 4. Obtener reviews (comentarios)
    const [reviews] = await pool.query(
      `SELECT r.calificacion, r.comentario, r.fecha_comentario, u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       JOIN usuarios u ON r.cliente_id = u.id
       WHERE ct.servicio_id IN (?)`,
      [servicioIds]
    );

    // 5. Promedio de calificaciones
    const [promedioResult] = await pool.query(
      `SELECT AVG(r.calificacion) AS promedio
       FROM comentarios r
       JOIN contrataciones ct ON r.contratacion_id = ct.id
       WHERE ct.servicio_id IN (?)`,
      [servicioIds]
    );

    const promedio = promedioResult[0].promedio
      ? parseFloat(promedioResult[0].promedio).toFixed(2)
      : null;

    // 6. Si es el dueño → estadísticas privadas
    let estadisticas = null;

    if (esPropietario && servicioIds.length > 0) {
      // a. Visualizaciones por servicio
      const [vistas] = await pool.query(
        `SELECT servicio_id, COUNT(*) AS visualizaciones
         FROM visualizaciones
         WHERE servicio_id IN (?)
         GROUP BY servicio_id`,
        [servicioIds]
      );

      // b. Contrataciones por servicio
      const [contratos] = await pool.query(
        `SELECT servicio_id, COUNT(*) AS contrataciones
         FROM contrataciones
         WHERE estado = 'aceptado' AND servicio_id IN (?)
         GROUP BY servicio_id`,
        [servicioIds]
      );

      // c. Distribución de calificaciones
      const [distribucion] = await pool.query(
        `SELECT r.calificacion, COUNT(*) AS cantidad
         FROM comentarios r
         JOIN contrataciones ct ON r.contratacion_id = ct.id
         WHERE ct.servicio_id IN (?)
         GROUP BY r.calificacion`,
        [servicioIds]
      );

      // d. Cantidad total de reviews
      const cantidadCalificaciones = reviews.length;

      // e. Armar tasas de conversión
      const conversiones = servicios.map(servicio => {
        const vistasServicio = vistas.find(v => v.servicio_id === servicio.id)?.visualizaciones || 0;
        const contratosServicio = contratos.find(c => c.servicio_id === servicio.id)?.contrataciones || 0;
        const tasa = vistasServicio > 0 ? ((contratosServicio / vistasServicio) * 100).toFixed(2) : '0.00';

        return {
          servicio_id: servicio.id,
          visualizaciones: vistasServicio,
          contrataciones: contratosServicio,
          tasa_conversion: `${tasa}%`
        };
      });

      estadisticas = {
        conversiones,
        promedio_calificacion: promedio,
        cantidad_calificaciones: cantidadCalificaciones,
        distribucion_calificaciones: distribucion.reduce((acc, curr) => {
          acc[curr.calificacion] = curr.cantidad;
          return acc;
        }, {})
      };
    }

    // 7. Respuesta final
    return res.json({
      entrenador,
      servicios: serviciosPublicos,
      reviews,
      promedio_calificacion: promedio,
      ...(estadisticas && { estadisticas })
    });
  } catch (error) {
    console.error('Error al obtener perfil del entrenador:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};