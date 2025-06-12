const express = require('express');
const router = express.Router();
const trainersController = require('../controllers/trainersController');
const { verificarToken } = require('../middleware/authMiddleware');
const { permitirRol } = require('../middleware/rolesMiddleware');
const validarBodyNoVacio = require('../middleware/bodyNotEmptyMiddleware');
const { verificarTokenOpcional } = require('../middleware/optionalTokenMiddleware');
const crearMulter = require('../utils/multer');

const uploadPerfil = crearMulter('profile-pictures', {
  extensiones: ['.jpg', '.jpeg', '.png']
});

// Perfil público del entrenador (servicios, reviews, promedio, etc.)
router.get('/:id', 
  verificarTokenOpcional, 
  trainersController.obtenerPerfilEntrenador);

router.patch(
  '/:id',
  verificarToken,
  permitirRol('entrenador'),
  uploadPerfil.single('profile_picture'),
  trainersController.editarPerfilEntrenador
);

router.post(
  '/:id/reviews',
  verificarToken,
  permitirRol('cliente'),
  validarBodyNoVacio,
  trainersController.comentarEntrenador
);

//GET de todos los servicios de un entrenador
router.get(
  '/:id/services', 
  verificarToken,
  permitirRol('entrenador'),
  trainersController.obtenerServiciosDelEntrenador);

module.exports = router;