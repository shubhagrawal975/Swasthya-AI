const rateLimit = require('express-rate-limit');
const msg = (m) => ({ success: false, message: m });
const generalLimiter = rateLimit({ windowMs:parseInt(process.env.RATE_LIMIT_WINDOW_MS)||900000, max:parseInt(process.env.RATE_LIMIT_MAX)||200, standardHeaders:true, legacyHeaders:false, message:msg('Too many requests.') });
const authLimiter    = rateLimit({ windowMs:900000, max:15, skipSuccessfulRequests:true, message:msg('Too many login attempts. Wait 15 min.') });
const otpLimiter     = rateLimit({ windowMs:600000, max:parseInt(process.env.OTP_RATE_LIMIT_MAX)||5, message:msg('Too many OTP requests. Wait 10 min.') });
const aiChatLimiter  = rateLimit({ windowMs:60000,  max:20, message:msg('AI chat rate limit. Wait a moment.') });
const uploadLimiter  = rateLimit({ windowMs:3600000,max:20, message:msg('Too many file uploads.') });
module.exports = { generalLimiter, authLimiter, otpLimiter, aiChatLimiter, uploadLimiter };
