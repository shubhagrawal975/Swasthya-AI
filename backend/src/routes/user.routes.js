// user.routes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
r.get('/profile', authenticate, authorize('patient'), c.getProfile);
r.patch('/profile', authenticate, authorize('patient'), c.updateProfile);
r.get('/notifications', authenticate, authorize('patient'), c.getNotifications);
r.patch('/notifications/:id/read', authenticate, c.markNotificationRead);
r.get('/doctor-updates', c.getDoctorUpdates);
module.exports = r;
