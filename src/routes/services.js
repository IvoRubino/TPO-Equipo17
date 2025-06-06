const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/servicesController');
const { verificarToken } = require('../middleware/authMiddleware');
const { permitirRol } = require('../middleware/rolesMiddleware');
const validarBodyNoVacio = require('../middleware/bodyNotEmptyMiddleware');
const crearMulter = require('../utils/multer');

const uploadImagenes = crearMulter('service-images');

//Obtiene servicios por filtros
router.get('/', servicesController.getServiciosConFiltros);

//Obtiene servicio por Id
router.get('/:id', servicesController.obtenerServicioPorId);

// Crear servicio (solo entrenadores)
router.post(
  '/',
  verificarToken,
  permitirRol('entrenador'),
  uploadImagenes.array('imagenes', 4),
  servicesController.crearServicio
);

router.put('/:id', verificarToken, servicesController.actualizarServicio);

router.delete(
  '/:id',
  verificarToken,
  permitirRol('entrenador'),
  servicesController.eliminarServicio
);

// Cambiar estado del servicio (publicar/despublicar)
router.patch(
  '/:id',
  verificarToken,
  permitirRol('entrenador'),
  validarBodyNoVacio,
  servicesController.cambiarEstadoServicio
);


module.exports = router;