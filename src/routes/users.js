const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const validarBodyNoVacio = require('../middleware/bodyNotEmptyMiddleware');

// Registrar usuario
router.post('/', validarBodyNoVacio, usersController.register);
router.get('/:id', usersController.getUsuarioById);

module.exports = router;