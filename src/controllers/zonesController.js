const pool = require('../config/db'); // Ajustá este path si tu archivo está en otro lugar

const getAllZones = async (_, res) => {
  try {
    const [zones] = await pool.query('SELECT id, nombre FROM zonas');
    const formattedZones = zones.map(zone => ({
      id: zone.id,
      name: zone.nombre
    }));
    res.json(formattedZones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getAllZones };