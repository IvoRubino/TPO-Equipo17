const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Registro de usuario
exports.register = async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword, type } = req.body;

  const description = req.body.description || '';
  const profilePicture = req.body.profilePicture || '/uploads/profile-pictures/default-profile.png';

  if (!firstName || !lastName || !email || !password || !type) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+[\]{};':"\\|,.<>/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message:
        'Password must be at least 8 characters long and include one uppercase letter, one number, and one special character.'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    // Check if email already exists
    const [exist] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [email]);
    if (exist.length > 0) {
      return res.status(400).json({ message: 'A user with that email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (nombre, apellido, correo, password, tipo, descripcion, foto_perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, email, hashedPassword, type, description, profilePicture]
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

//GET de usuario por Id
exports.getUsuarioById = async (req, res) => {
   const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT id, nombre AS firstName, apellido AS lastName, correo AS email, tipo AS type, descripcion AS description, foto_perfil AS profilePicture FROM usuarios WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};