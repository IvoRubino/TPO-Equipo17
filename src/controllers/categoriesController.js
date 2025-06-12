const pool = require('../config/db');

const getAllCategories = async (_, res) => {
  try {
    const [categories] = await pool.query('SELECT id, nombre FROM categorias');
    const formatted = categories.map(category => ({
      id: category.id,
      name: category.nombre
    }));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getAllCategories };