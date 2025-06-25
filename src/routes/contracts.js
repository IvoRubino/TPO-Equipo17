const express = require('express');
const router = express.Router();

const contractsController = require('../controllers/contractsController');
const { verificarToken } = require('../middleware/authMiddleware');
const { permitirRol } = require('../middleware/rolesMiddleware');
const validarBodyNoVacio = require('../middleware/bodyNotEmptyMiddleware');
const crearMulter = require('../utils/multer');

const uploadFiles = crearMulter('contract-files');

//get que usa token para traer contrataciones
router.get('/', verificarToken, contractsController.obtenerContrataciones);

router.get('/:id', verificarToken, contractsController.obtenerContratacionPorId);

//permite a cliente contratar servicio
router.post('/', verificarToken, permitirRol('cliente'),  validarBodyNoVacio, contractsController.crearContrato);

// Actualizar estado o agendar sesión
router.patch('/:id', verificarToken, validarBodyNoVacio, contractsController.actualizarContrato);

//GET a las files, solo puede el entrenador y cliente correspondiente
router.get('/:id/files', verificarToken, contractsController.getArchivosContratacion);

//POST para files
router.post('/:id/files', verificarToken, uploadFiles.single('file'), contractsController.subirArchivoContratacion);


module.exports = router;