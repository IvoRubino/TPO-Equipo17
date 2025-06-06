const pool = require('../config/db');

exports.crearServicio = async (req, res) => {
  const entrenador_id = req.user.id;
  const {
    categoria,
    descripcion,
    duracion_minutos,
    cantidad_sesiones,
    precio,
    modalidad,
    zona,
    direccion,
    dias,
    horario_inicio,
    horario_fin
  } = req.body;

  // Validación básica
  if (!categoria || !descripcion || !duracion_minutos || !cantidad_sesiones || !precio || !modalidad || !dias) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }

  if (!['virtual', 'presencial'].includes(modalidad)) {
    return res.status(400).json({ message: 'La modalidad debe ser "virtual" o "presencial"' });
  }

  if (modalidad === 'presencial' && (!direccion || !zona)) {
    return res.status(400).json({ message: 'Zona y dirección son obligatorias en modalidad presencial' });
  }

  // Validación de horarios
  if (!horario_inicio || !horario_fin) {
    return res.status(400).json({ message: 'Se debe indicar el horario de inicio y fin' });
  }

  const regexHora = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!regexHora.test(horario_inicio) || !regexHora.test(horario_fin)) {
    return res.status(400).json({ message: 'El horario debe tener formato HH:MM (ej: 09:30)' });
  }

  if (horario_inicio >= horario_fin) {
    return res.status(400).json({ message: 'El horario de inicio debe ser anterior al de fin' });
  }

  // Validación de días
  const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const diasFiltrados = Array.isArray(dias)
    ? dias.filter((d) => diasValidos.includes(d))
    : [];

  if (diasFiltrados.length === 0) {
    return res.status(400).json({ message: 'Debés seleccionar al menos un día válido' });
  }

  try {
    // Obtener ID de la categoría
    const [catResult] = await pool.query(
      'SELECT id FROM categorias WHERE nombre = ?',
      [categoria]
    );
    if (catResult.length === 0) {
      return res.status(400).json({ message: 'La categoría no existe' });
    }
    const categoria_id = catResult[0].id;

    // Obtener ID de la zona (solo si es presencial)
    let zona_id = null;
    if (modalidad === 'presencial') {
      const [zonaResult] = await pool.query(
        'SELECT id FROM zonas WHERE nombre = ?',
        [zona]
      );
      if (zonaResult.length === 0) {
        return res.status(400).json({ message: 'La zona no existe' });
      }
      zona_id = zonaResult[0].id;
    } else {
      // Buscar el ID de la zona "virtual"
      const [zonaVirtual] = await pool.query(
        'SELECT id FROM zonas WHERE nombre = "virtual"'
      );
      zona_id = zonaVirtual.length > 0 ? zonaVirtual[0].id : null;
    }

    const direccionFinal = modalidad === 'virtual' ? 'virtual' : direccion;

    // Insertar servicio
    const [resultado] = await pool.query(
      `INSERT INTO servicios 
       (entrenador_id, categoria_id, descripcion, duracion_minutos, cantidad_sesiones, precio, modalidad, zona_id, direccion, horario_inicio, horario_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entrenador_id,
        categoria_id,
        descripcion,
        duracion_minutos,
        cantidad_sesiones,
        precio,
        modalidad,
        zona_id,
        direccionFinal,
        horario_inicio,
        horario_fin
      ]
    );

    const servicio_id = resultado.insertId;

    // Insertar días disponibles
    const inserts = diasFiltrados.map((dia) =>
      pool.query(
        'INSERT INTO dias_servicio (servicio_id, dia) VALUES (?, ?)',
        [servicio_id, dia]
      )
    );

    await Promise.all(inserts);

    res.status(201).json({ message: 'Servicio creado correctamente' });
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

//actualiza servicio (es un PUT)
exports.actualizarServicio = async (req, res) => {
  const servicioId = parseInt(req.params.id);
  const entrenadorId = req.user.id;

  const {
    categoria_id, zona_id, descripcion, duracion_minutos,
    cantidad_sesiones, modalidad, direccion, precio,
    horario_inicio, horario_fin,
    imagenesAEliminar = [],
    imagenesNuevas = []
  } = req.body;

  try {
    // Verificar que el servicio exista y pertenezca al entrenador
    const [result] = await pool.query(
      `SELECT * FROM servicios WHERE id = ?`,
      [servicioId]
    );

    if (result.length === 0) {
      return res.status(404).json({ message: 'Servicio no encontrado' });
    }

    const servicio = result[0];

    if (servicio.entrenador_id !== entrenadorId) {
      return res.status(403).json({ message: 'No tenés permiso para editar este servicio' });
    }

    // Validación de imágenes
    const [existentes] = await pool.query(
      `SELECT COUNT(*) AS total FROM imagenes_servicio WHERE servicio_id = ?`,
      [servicioId]
    );

    const totalActuales = existentes[0].total;
    const totalLuego = totalActuales - imagenesAEliminar.length + imagenesNuevas.length;

    if (totalLuego > 4) {
      return res.status(400).json({
        message: `No podés tener más de 4 imágenes. Actualmente hay ${totalActuales}, querés eliminar ${imagenesAEliminar.length} y subir ${imagenesNuevas.length}`
      });
    }
    // Si la modalidad es virtual, se fuerza la dirección y zona a 'virtual'
    let direccionFinal = direccion;
    let zona_idFinal = zona_id;

    if (modalidad === 'virtual') {
      direccionFinal = 'virtual';

    // Buscamos el ID de la zona que se llama 'virtual'
    const [zonaVirtual] = await pool.query(`SELECT id FROM zonas WHERE nombre = 'virtual' LIMIT 1`);
    if (zonaVirtual.length === 0) {
      return res.status(400).json({ message: "Zona 'virtual' no está registrada en la base de datos" });
    }
    zona_idFinal = zonaVirtual[0].id;
    }
    

    // 1. Actualizar campos del servicio
    await pool.query(
      `UPDATE servicios
       SET categoria_id = ?, zona_id = ?, descripcion = ?, duracion_minutos = ?, cantidad_sesiones = ?,
           modalidad = ?, direccion = ?, precio = ?, horario_inicio = ?, horario_fin = ?
       WHERE id = ?`,
      [
        categoria_id, zona_id, descripcion, duracion_minutos, cantidad_sesiones,
        modalidad, direccion, precio, horario_inicio, horario_fin, servicioId
      ]
    );

    // 2. Eliminar imágenes
    if (imagenesAEliminar.length > 0) {
      await pool.query(
        `DELETE FROM imagenes_servicio WHERE servicio_id = ? AND ruta IN (?)`,
        [servicioId, imagenesAEliminar]
      );
    }

    // 3. Agregar nuevas imágenes
    for (const ruta of imagenesNuevas) {
      await pool.query(
        `INSERT INTO imagenes_servicio (servicio_id, ruta) VALUES (?, ?)`,
        [servicioId, ruta]
      );
    }

    res.json({ message: 'Servicio actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(500).json({ message: 'Error al actualizar servicio' });
  }
};
