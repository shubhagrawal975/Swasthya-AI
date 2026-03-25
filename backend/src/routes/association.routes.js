// association.routes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/association.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
r.post('/', authenticate, authorize('doctor'), c.createAssociation);
r.get('/', authenticate, authorize('doctor'), c.getAssociations);
r.post('/:id/join', authenticate, authorize('doctor'), c.joinAssociation);
module.exports = r;
