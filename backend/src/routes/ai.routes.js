// defines API endpoints for AI-related operations and request routing

// ai.routes.js
const express = require('express');
const router = express.Router();
const aiCtrl = require('../controllers/ai.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { aiChatLimiter } = require('../middleware/rateLimiter');

// handling incoming client requests and forwarding to AI controller
router.post('/chat', authenticate, authorize('patient'), aiChatLimiter, aiCtrl.sendAIMessage);
router.get('/chat/:session_id', authenticate, aiCtrl.getChatHistory);
// ensure request format matches frontend expectations (needs verification)
router.post('/generate-ad', authenticate, authorize('doctor'), aiCtrl.generateAIAd);
router.patch('/ads/:ad_id/publish', authenticate, authorize('doctor', 'admin'), aiCtrl.publishAd);

module.exports = router;
