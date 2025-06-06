const cron = require('node-cron');
const pool = require('../config/db');

// Todos los días a la 1 AM borra los tokens vencidos
cron.schedule('0 1 * * *', async () => {
  try {
    await pool.query('DELETE FROM password_resets WHERE expiracion < NOW()');
    console.log('Tokens expirados eliminados');
  } catch (error) {
    console.error('Error al limpiar tokens:', error);
  }
});