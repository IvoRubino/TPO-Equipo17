const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const [usuarios] = await pool.query(
      'SELECT id, correo, password, tipo FROM usuarios WHERE correo = ?',
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const usuario = usuarios[0];
    const match = await bcrypt.compare(password, usuario.password);

    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: {
        id: usuario.id,
        email: usuario.correo,
        type: usuario.tipo
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [email]);
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'INSERT INTO password_resets (correo, token, expiracion) VALUES (?, ?, ?)',
      [email, token, expiracion]
    );

    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Reset Your Password',
      html: `<p>Click the following link to reset your password:</p><a href="${link}">${link}</a>`
    });

    res.json({ message: 'Reset instructions sent to your email' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  try {
    const [resets] = await pool.query('SELECT * FROM password_resets WHERE token = ?', [token]);

    if (resets.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const reset = resets[0];
    if (new Date(reset.expiracion) < new Date()) {
      return res.status(400).json({ message: 'Token has expired' });
    }

    const email = reset.correo;

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long and include an uppercase letter, a number, and a special character.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query('UPDATE usuarios SET password = ? WHERE correo = ?', [hashedPassword, email]);
    await pool.query('DELETE FROM password_resets WHERE correo = ?', [email]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
