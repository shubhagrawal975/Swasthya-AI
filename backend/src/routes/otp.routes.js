const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const otpCtrl = require('../controllers/otp.controller');
const { otpLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

const mobileRule = body('mobile')
  .trim()
  .matches(/^\+?[1-9]\d{7,14}$/)
  .withMessage('Valid mobile number required (e.g. +919876543210)');

const purposeRule = body('purpose')
  .isIn(['registration','login','forgot_password','doctor_register'])
  .withMessage('Invalid purpose');

const otpRule = body('otp')
  .isLength({ min: 4, max: 8 })
  .isNumeric()
  .withMessage('OTP must be numeric');

// POST /api/otp/send
router.post('/send', otpLimiter, [mobileRule, purposeRule], validate, otpCtrl.sendOTP);

// POST /api/otp/verify
router.post('/verify', otpLimiter, [mobileRule, purposeRule, otpRule], validate, otpCtrl.verifyOTPEndpoint);

// POST /api/otp/resend
router.post('/resend', otpLimiter, [mobileRule, purposeRule], validate, otpCtrl.resendOTP);

// POST /api/otp/reset-password
router.post('/reset-password', otpLimiter, [
  mobileRule, otpRule,
  body('new_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], validate, otpCtrl.resetPassword);

module.exports = router;
