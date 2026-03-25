// camp.routes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/camp.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const upload = require('../utils/upload');
r.post('/', authenticate, authorize('doctor'), upload.single('banner_image'), c.createCamp);
r.get('/', c.getCamps);
r.get('/my', authenticate, authorize('doctor'), c.getDoctorCamps);
r.post('/:camp_id/register', authenticate, authorize('patient'), c.registerForCamp);
module.exports = r;
