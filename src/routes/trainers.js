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

// GET a perfil del entrenador
router.get('/:id', 
  trainersController.obtenerPerfilEntrenador);

router.get('/:id/reviews', 
  trainersController.obtenerReviewsEntrenador);

router.get(
  '/:id/statistics', 
  verificarToken,
  trainersController.obtenerEstadisticasEntrenador);

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
  verificarTokenOpcional,
  trainersController.obtenerServiciosDelEntrenador);

router.get('/:id/busy-times', trainersController.obtenerDiasOcupados);

module.exports = router;