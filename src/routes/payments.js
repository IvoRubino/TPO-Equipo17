const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/paymentsController');
const { verificarToken } = require('../middleware/authMiddleware');

// Crear sesión de pago (cliente autenticado)
router.post('/create-checkout-session', verificarToken, paymentsController.createCheckoutSession);

// Webhook de Stripe (sin auth)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentsController.webhookStripe);

module.exports = router;