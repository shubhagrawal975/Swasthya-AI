// doctor.routes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/doctor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
r.get('/profile', authenticate, authorize('doctor'), c.getProfile);
r.patch('/profile', authenticate, authorize('doctor'), c.updateProfile);
r.get('/patients', authenticate, authorize('doctor'), c.getPatients);
r.get('/dashboard', authenticate, authorize('doctor'), c.getDashboardStats);
r.get('/verification', authenticate, authorize('doctor'), c.getVerificationStatus);
r.get('/list', c.listDoctors);
module.exports = r;
