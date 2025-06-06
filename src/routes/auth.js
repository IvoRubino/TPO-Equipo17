const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validarBodyNoVacio = require('../middleware/bodyNotEmptyMiddleware');

router.post('/login', validarBodyNoVacio, authController.login);
router.post('/forgot-password', validarBodyNoVacio, authController.forgotPassword);
router.post('/reset-password', validarBodyNoVacio, authController.resetPassword);


module.exports = router;
