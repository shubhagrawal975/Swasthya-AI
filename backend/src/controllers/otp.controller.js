const { query } = require('../config/database');
const { initiateOTP, verifyOTP } = require('../services/otp.service');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * POST /api/otp/send
 * Body: { mobile, purpose }
 * purpose: registration | login | forgot_password | doctor_register
 */
exports.sendOTP = async (req, res, next) => {
  try {
    const { mobile, purpose } = req.body;

    // Validate purpose
    const validPurposes = ['registration', 'login', 'forgot_password', 'doctor_register'];
    if (!validPurposes.includes(purpose)) {
      return next(new AppError(`Invalid purpose. Must be one of: ${validPurposes.join(', ')}`, 400));
    }

    // For login/forgot_password — verify user exists
    if (purpose === 'login' || purpose === 'forgot_password') {
      const userRes = await query(
        `SELECT id FROM users WHERE mobile=$1 AND is_active=TRUE
         UNION ALL
         SELECT id FROM doctors WHERE mobile=$1 AND is_active=TRUE`,
        [mobile]
      );
      if (!userRes.rows[0]) {
        // Don't reveal if mobile exists — security best practice
        return res.json({
          success: true,
          message: 'If this mobile number is registered, an OTP has been sent.',
        });
      }
    }

    const result = await initiateOTP(mobile, purpose);

    // Audit log
    await query(
      `INSERT INTO audit_logs (actor_role, action, details, ip_address) VALUES ('anonymous','OTP_SENT',$1,$2)`,
      [JSON.stringify({ mobile: result.maskedMobile, purpose }), req.ip]
    );

    res.json({
      success: true,
      message: `OTP sent to ${result.maskedMobile}`,
      data: {
        masked_mobile: result.maskedMobile,
        expires_in_minutes: result.expiresInMinutes,
        cooldown_seconds: result.cooldownSeconds,
        otp_id: result.otpId,
      },
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/otp/verify
 * Body: { mobile, purpose, otp }
 * Returns verified=true — caller then proceeds to their specific action
 */
exports.verifyOTPEndpoint = async (req, res, next) => {
  try {
    const { mobile, purpose, otp } = req.body;

    await verifyOTP(mobile, purpose, otp);

    // Mark mobile as verified in users/doctors table
    if (purpose === 'registration') {
      await query(`UPDATE users SET mobile_verified=TRUE WHERE mobile=$1`, [mobile]);
    } else if (purpose === 'doctor_register') {
      await query(`UPDATE doctors SET mobile_verified=TRUE WHERE mobile=$1`, [mobile]);
    }

    // Audit
    await query(
      `INSERT INTO audit_logs (actor_role, action, details, ip_address) VALUES ('anonymous','OTP_VERIFIED',$1,$2)`,
      [JSON.stringify({ mobile: mobile.slice(0,-6) + '****', purpose }), req.ip]
    );

    res.json({ success: true, message: 'OTP verified successfully', data: { verified: true } });
  } catch (err) { next(err); }
};

/**
 * POST /api/otp/resend
 * Body: { mobile, purpose }
 */
exports.resendOTP = async (req, res, next) => {
  try {
    const { mobile, purpose } = req.body;
    const result = await initiateOTP(mobile, purpose);

    res.json({
      success: true,
      message: `New OTP sent to ${result.maskedMobile}`,
      data: {
        masked_mobile: result.maskedMobile,
        expires_in_minutes: result.expiresInMinutes,
        cooldown_seconds: result.cooldownSeconds,
      },
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/otp/reset-password
 * Body: { mobile, otp, new_password }
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { mobile, otp, new_password } = req.body;
    const bcrypt = require('bcryptjs');

    await verifyOTP(mobile, 'forgot_password', otp);

    const hash = await bcrypt.hash(new_password, 12);

    // Update in both tables (user might be patient or doctor)
    await query(`UPDATE users   SET password_hash=$1 WHERE mobile=$2`, [hash, mobile]);
    await query(`UPDATE doctors SET password_hash=$1 WHERE mobile=$2`, [hash, mobile]);

    // Invalidate all refresh tokens
    await query(`UPDATE users   SET refresh_token=NULL WHERE mobile=$1`, [mobile]);
    await query(`UPDATE doctors SET refresh_token=NULL WHERE mobile=$1`, [mobile]);

    await query(
      `INSERT INTO audit_logs (actor_role, action, details, ip_address) VALUES ('anonymous','PASSWORD_RESET',$1,$2)`,
      [JSON.stringify({ mobile: mobile.slice(0,-6)+'****' }), req.ip]
    );

    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) { next(err); }
};
