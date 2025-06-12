const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Importar rutas
const userRoutes = require('./src/routes/users');
const authRoutes = require('./src/routes/auth');
const trainersRoutes = require('./src/routes/trainers');
const servicesRoutes = require('./src/routes/services');
const contractRoutes = require('./src/routes/contracts');

// Tareas programadas
require('./src/utils/cron');

// Configuración de CORS
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Permitir herramientas como Postman

    // Permitir cualquier localhost en desarrollo
    if (isDev && origin.includes('localhost')) {
      return callback(null, true);
    }

    // Producción: lista de orígenes permitidos
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('No permitido por CORS'));
  },
  credentials: true
}));

// Middlewares
app.use(express.json());

// Servir archivos estáticos (como imágenes subidas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas de API
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trainers', trainersRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/contracts', contractRoutes);


// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});