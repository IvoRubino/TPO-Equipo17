const pool = require('../config/db');

exports.obtenerContrataciones = async (req, res) => {
  const { id, tipo } = req.user;

  try {
    let query = '';
    let params = [];

    if (tipo === 'cliente') {
      query = `
        SELECT 
          con.id AS contract_id,
          s.id AS service_id,
          s.nombre AS service_name,
          CONCAT(e.nombre, ' ', e.apellido) AS trainer,
          con.estado AS state,
          con.fecha_solicitud AS requested_at,
          con.fecha_inicio AS start_date,
          con.dia_semana AS weekday,
          con.hora_inicio AS start_time
        FROM contrataciones con
        JOIN servicios s ON con.servicio_id = s.id
        JOIN usuarios e ON s.entrenador_id = e.id
        WHERE con.cliente_id = ?
      `;
      params = [id];
    } else if (tipo === 'entrenador') {
      query = `
        SELECT 
          con.id AS contract_id,
          s.id AS service_id,
          s.nombre AS service_name,
          CONCAT(c.nombre, ' ', c.apellido) AS client,
          con.estado AS state,
          con.fecha_solicitud AS requested_at,
          con.fecha_inicio AS start_date,
          con.dia_semana AS weekday,
          con.hora_inicio AS start_time
        FROM contrataciones con
        JOIN servicios s ON con.servicio_id = s.id
        JOIN usuarios c ON con.cliente_id = c.id
        WHERE s.entrenador_id = ?
      `;
      params = [id];
    } else {
      return res.status(403).json({ message: 'Unauthorized user type' });
    }

    const [result] = await pool.query(query, params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ message: 'Server error while fetching contracts' });
  }
};

exports.crearContrato = async (req, res) => {
  const { service_id } = req.body;
  const user = req.user;

  try {
    if (user.tipo !== 'cliente') {
      return res.status(403).json({ message: 'Only clients can hire services' });
    }

    const [services] = await pool.query(
      'SELECT * FROM servicios WHERE id = ? AND estado = "publicado"',
      [service_id]
    );

    if (services.length === 0) {
      return res.status(404).json({ message: 'Service not available' });
    }

    await pool.query(
      `INSERT INTO contrataciones (cliente_id, servicio_id, estado)
       VALUES (?, ?, 'pendiente')`,
      [user.id, service_id]
    );

    res.status(201).json({ message: 'Contract request submitted successfully' });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.actualizarContrato = async (req, res) => {
  const contractId = req.params.id;
  const { status, start_date, day_of_week, start_time } = req.body;
  const user = req.user;

  try {
    const [contracts] = await pool.query(
      `SELECT c.*, s.entrenador_id, s.horario_inicio AS service_start_time, s.horario_fin
       FROM contrataciones c
       JOIN servicios s ON c.servicio_id = s.id
       WHERE c.id = ?`,
      [contractId]
    );

    if (contracts.length === 0) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const contract = contracts[0];

    if (status) {
      if (!['aceptado', 'cancelado', 'completado'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      if (status === 'aceptado') {
        if (user.tipo !== 'entrenador' || user.id !== contract.entrenador_id) {
          return res.status(403).json({ message: 'Only the trainer can accept this contract' });
        }
      }

      if (status === 'cancelado') {
        const isClient = user.id === contract.cliente_id && user.tipo === 'cliente';
        const isTrainer = user.id === contract.entrenador_id && user.tipo === 'entrenador';

        if (!isClient && !isTrainer) {
          return res.status(403).json({ message: 'You do not have permission to cancel this contract' });
        }
      }

      await pool.query('UPDATE contrataciones SET estado = ? WHERE id = ?', [status, contractId]);
    }

    const wantsToSchedule =
      start_date !== undefined ||
      day_of_week !== undefined ||
      start_time !== undefined;

    if (wantsToSchedule) {
      if (!start_date || !day_of_week || !start_time) {
        return res.status(400).json({
          message: 'Missing fields for scheduling: start_date, day_of_week and start_time are required'
        });
      }

      if (user.tipo !== 'cliente' || user.id !== contract.cliente_id) {
        return res.status(403).json({ message: 'Only the client can schedule the session' });
      }

      if (contract.estado !== 'accepted') {
        return res.status(400).json({ message: 'The contract must be accepted before scheduling' });
      }

      const [allowedDays] = await pool.query(
        'SELECT * FROM dias_servicio WHERE servicio_id = ? AND dia = ?',
        [contract.servicio_id, day_of_week]
      );

      if (allowedDays.length === 0) {
        return res.status(400).json({ message: `The service is not available on ${day_of_week}` });
      }

      if (start_time < contract.service_start_time || start_time >= contract.horario_fin) {
        return res.status(400).json({ message: 'Selected time is outside available hours' });
      }

      const [overlaps] = await pool.query(
        `SELECT * FROM contrataciones
         WHERE servicio_id = ?
           AND estado = 'aceptado'
           AND id != ?
           AND dia_semana = ?
           AND hora_inicio = ?`,
        [contract.servicio_id, contractId, day_of_week, start_time]
      );

      if (overlaps.length > 0) {
        return res.status(400).json({ message: 'This time is already booked by another client' });
      }

      await pool.query(
        `UPDATE contrataciones
         SET dia_semana = ?, hora_inicio = ?, fecha_inicio = ?
         WHERE id = ?`,
        [day_of_week, start_time, start_date, contractId]
      );
    }

    res.json({ message: 'Contract updated successfully' });
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getArchivosContratacion = async (req, res) => {
  const contractId = parseInt(req.params.id);
  const user = req.user;

  try {
    const [contracts] = await pool.query(`
      SELECT c.*, s.entrenador_id
      FROM contrataciones c
      JOIN servicios s ON c.servicio_id = s.id
      WHERE c.id = ?
      AND c.estado = 'aceptado'
    `, [contractId]);

    if (contracts.length === 0) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const contract = contracts[0];
    const isClient = contract.cliente_id === user.id;
    const isTrainer = contract.entrenador_id === user.id;

    if (!isClient && !isTrainer) {
      return res.status(403).json({ message: 'You do not have permission to access these files' });
    }

    const [files] = await pool.query(`
      SELECT archivo_id AS file_id, nombre AS name, ruta AS path, fecha_subida AS uploaded_at
      FROM archivos_contratacion
      WHERE contratacion_id = ?
    `, [contractId]);

    res.json(files);
  } catch (error) {
    console.error('Error fetching contract files:', error);
    res.status(500).json({ message: 'Error retrieving files' });
  }
};

exports.subirArchivoContratacion = async (req, res) => {
  const contractId = parseInt(req.params.id);
  const user = req.user;

  try {
    const [contracts] = await pool.query(`
      SELECT c.*, s.entrenador_id
      FROM contrataciones c
      JOIN servicios s ON c.servicio_id = s.id
      WHERE c.id = ?
      AND c.estado = 'accepted'
    `, [contractId]);

    if (contracts.length === 0) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    const contract = contracts[0];
    if (contract.entrenador_id !== user.id) {
      return res.status(403).json({ message: 'Only the trainer can upload files' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file received' });
    }

    const name = req.file.originalname;
    const path = `/uploads/contract-files/${req.file.filename}`;

    await pool.query(`
      INSERT INTO archivos_contratacion (contratacion_id, nombre, ruta)
      VALUES (?, ?, ?)
    `, [contractId, name, path]);

    res.status(201).json({ message: 'File uploaded successfully', name, path });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
};
