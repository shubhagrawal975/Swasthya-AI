// healthPlan.routes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/healthPlan.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
r.get('/', authenticate, authorize('patient'), c.getMyPlans);
r.post('/', authenticate, authorize('patient'), c.createPlan);
r.patch('/:plan_id/tasks', authenticate, authorize('patient'), c.updateTaskCompletion);
module.exports = r;
