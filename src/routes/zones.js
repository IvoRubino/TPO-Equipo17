const express = require('express');
const router = express.Router();
const zonesController = require('../controllers/zonesController');

router.get('/', zonesController.getAllZones);

module.exports = router;