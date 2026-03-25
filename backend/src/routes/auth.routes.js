const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authCtrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const upload = require('../utils/upload');
const validate = require('../middleware/validate');

const mobileRule = body('mobile').trim().matches(/^\+?[1-9]\d{7,14}$/).withMessage('Valid mobile required');
const pwRule     = body('password').isLength({ min: 8 }).withMessage('Password min 8 chars');

router.post('/register/user', authLimiter, [body('first_name').trim().notEmpty(),body('last_name').trim().notEmpty(),mobileRule,pwRule], validate, authCtrl.registerUser);
router.post('/login/user',    authLimiter, [mobileRule, body('password').notEmpty()], validate, authCtrl.loginUser);
router.post('/login/user/otp',otpLimiter,  [mobileRule, body('otp').isNumeric().isLength({min:4,max:8})], validate, authCtrl.loginUserWithOTP);

router.post('/register/doctor', authLimiter,
  upload.fields([{name:'degree_certificate',maxCount:1},{name:'mci_certificate',maxCount:1},{name:'additional_docs',maxCount:3}]),
  [body('first_name').trim().notEmpty(),body('last_name').trim().notEmpty(),mobileRule,body('email').isEmail(),pwRule,body('specialization').trim().notEmpty(),body('mci_number').trim().notEmpty(),body('years_experience').isInt({min:0,max:60})],
  validate, authCtrl.registerDoctor
);
router.post('/login/doctor', authLimiter, [body('mci_number').trim().notEmpty(),body('password').notEmpty()], validate, authCtrl.loginDoctor);
router.post('/login/doctor/otp', otpLimiter, [mobileRule, body('otp').isNumeric().isLength({min:4,max:8})], validate, authCtrl.loginDoctorWithOTP);
router.post('/login/admin', authLimiter, [body('email').isEmail(), body('password').isLength({min:8})], validate, authCtrl.loginAdmin);
router.post('/verify-otp',   otpLimiter,  [mobileRule,body('otp').isNumeric().isLength({min:4,max:8}),body('role').isIn(['patient','doctor'])], validate, authCtrl.verifyLoginOTP);
router.post('/refresh-token', authCtrl.refreshToken);
router.post('/logout', authenticate, authCtrl.logout);

module.exports = router;
