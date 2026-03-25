const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { getVideoToken } = require('../controllers/appointment.controller');

router.get('/token/:appointment_id', authenticate, getVideoToken);

module.exports = router;
