const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const { verificarToken } = require('../middleware/authMiddleware');
const { permitirRol } = require('../middleware/rolesMiddleware');

// Crear sesión de pago (cliente autenticado)
router.post('/create-checkout-session', verificarToken, permitirRol('cliente'), paymentsController.createCheckoutSession);

// Webhook de Stripe (sin auth)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentsController.webhookStripe);

module.exports = router;