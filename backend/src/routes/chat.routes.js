// chat.routes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth.middleware');
r.post('/sessions', authenticate, c.createSession);
r.get('/sessions', authenticate, c.getSessions);
r.get('/sessions/:session_id/messages', authenticate, c.getMessages);
r.post('/sessions/:session_id/messages', authenticate, c.sendMessage);
module.exports = r;
