const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
require('dotenv').config();

const userRoutes = require('./src/routes/users');
const authRoutes = require('./src/routes/auth');
const trainersRoutes = require('./src/routes/trainers');
const servicesRoutes = require('./src/routes/services');
const contractRoutes = require('./src/routes/contracts');
require('./src/utils/cron');

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trainers', trainersRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/contracts', contractRoutes);

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});