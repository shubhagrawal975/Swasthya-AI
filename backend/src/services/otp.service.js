/**
 * SwasthyaAI — OTP Service (Real Implementation)
 *
 * Features:
 *  - Cryptographically random OTP generation
 *  - bcrypt hashing before DB storage (never store plain OTP)
 *  - Expiry (configurable, default 10 min)
 *  - Resend cooldown (configurable, default 60 sec)
 *  - Max attempt tracking + lockout
 *  - Multi-provider SMS adapter (Twilio / MSG91 / Fast2SMS / console)
 *  - Full audit trail
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/database');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const CFG = {
  length:       parseInt(process.env.OTP_LENGTH || '6'),
  expiryMin:    parseInt(process.env.OTP_EXPIRY_MINUTES || '10'),
  maxAttempts:  parseInt(process.env.OTP_MAX_ATTEMPTS || '5'),
  cooldownSec:  parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60'),
  saltRounds:   parseInt(process.env.OTP_SALT_ROUNDS || '10'),
};

// ── Generate cryptographically random numeric OTP ─────────
function generateOTP() {
  if ((process.env.OTP_MODE || 'production').toLowerCase() === 'demo') {
    return '111111';
  }
  const max = Math.pow(10, CFG.length);
  const min = Math.pow(10, CFG.length - 1);
  // crypto.randomInt is cryptographically secure
  return crypto.randomInt(min, max).toString();
}

// ── Store OTP in DB (hashed) ──────────────────────────────
async function storeOTP(mobile, purpose, otp) {
  const hash = await bcrypt.hash(otp, CFG.saltRounds);
  const expiresAt = new Date(Date.now() + CFG.expiryMin * 60 * 1000);
  const canResendAt = new Date(Date.now() + CFG.cooldownSec * 1000);

  // Invalidate any existing OTPs for same mobile+purpose
  await query(
    `UPDATE otp_logs SET verified=TRUE WHERE mobile=$1 AND purpose=$2 AND verified=FALSE`,
    [mobile, purpose]
  );

  const result = await query(
    `INSERT INTO otp_logs (mobile, otp_hash, purpose, expires_at, can_resend_at, attempts)
     VALUES ($1,$2,$3,$4,$5,0) RETURNING id`,
    [mobile, hash, purpose, expiresAt, canResendAt]
  );

  logger.info(`OTP stored for ${mobile} purpose=${purpose} otpId=${result.rows[0].id}`);
  return result.rows[0].id;
}

// ── Verify OTP ────────────────────────────────────────────
async function verifyOTP(mobile, purpose, submittedOTP) {
  const result = await query(
    `SELECT id, otp_hash, expires_at, attempts, verified
     FROM otp_logs
     WHERE mobile=$1 AND purpose=$2 AND verified=FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [mobile, purpose]
  );

  if (!result.rows[0]) {
    throw new AppError('No active OTP found. Please request a new one.', 400);
  }

  const record = result.rows[0];

  // Check expiry
  if (new Date() > new Date(record.expires_at)) {
    await query(`UPDATE otp_logs SET verified=TRUE WHERE id=$1`, [record.id]);
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  // Check max attempts
  if (record.attempts >= CFG.maxAttempts) {
    await query(`UPDATE otp_logs SET verified=TRUE WHERE id=$1`, [record.id]);
    throw new AppError(`Too many failed attempts. Please request a new OTP.`, 429);
  }

  // Increment attempts
  await query(`UPDATE otp_logs SET attempts=attempts+1 WHERE id=$1`, [record.id]);

  // Constant-time comparison via bcrypt
  const isValid = await bcrypt.compare(submittedOTP, record.otp_hash);
  if (!isValid) {
    const remaining = CFG.maxAttempts - (record.attempts + 1);
    throw new AppError(
      remaining > 0
        ? `Invalid OTP. ${remaining} attempt(s) remaining.`
        : 'Invalid OTP. Maximum attempts reached.',
      400
    );
  }

  // Mark as verified
  await query(`UPDATE otp_logs SET verified=TRUE, verified_at=NOW() WHERE id=$1`, [record.id]);
  logger.info(`OTP verified for ${mobile} purpose=${purpose}`);
  return true;
}

// ── Check resend cooldown ─────────────────────────────────
async function checkResendCooldown(mobile, purpose) {
  const result = await query(
    `SELECT can_resend_at FROM otp_logs
     WHERE mobile=$1 AND purpose=$2 AND verified=FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [mobile, purpose]
  );

  if (result.rows[0]) {
    const canResendAt = new Date(result.rows[0].can_resend_at);
    if (new Date() < canResendAt) {
      const secondsLeft = Math.ceil((canResendAt - new Date()) / 1000);
      throw new AppError(`Please wait ${secondsLeft} seconds before requesting a new OTP.`, 429);
    }
  }
}

// ── Send OTP via configured SMS provider ──────────────────
async function sendOTP(mobile, otp, purpose) {
  // Demo mode: always send fixed OTP and no external provider calls.
  if ((process.env.OTP_MODE || 'production').toLowerCase() === 'demo') {
    logger.warn(`[OTP-DEMO] ${mobile} | OTP: ${otp} | purpose=${purpose}`);
    return { provider: 'demo', success: true, message: `Demo OTP ${otp}` };
  }

  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  const message = buildSMSMessage(otp, purpose);

  switch (provider) {
    case 'twilio':     return sendViaTwilio(mobile, message);
    case 'msg91':      return sendViaMSG91(mobile, otp, purpose);
    case 'fast2sms':   return sendViaFast2SMS(mobile, message);
    case 'console':
    default:
      logger.info(`[SMS-CONSOLE] To: ${mobile} | OTP: ${otp} | Purpose: ${purpose}`);
      logger.info(`[SMS-CONSOLE] Message: ${message}`);
      return { provider: 'console', success: true };
  }
}

function buildSMSMessage(otp, purpose) {
  const purposeText = {
    registration:   'Your SwasthyaAI registration OTP',
    login:          'Your SwasthyaAI login OTP',
    forgot_password:'Your SwasthyaAI password reset OTP',
    doctor_register:'Your SwasthyaAI doctor registration OTP',
  }[purpose] || 'Your SwasthyaAI OTP';

  return `${purposeText} is: ${otp}. Valid for ${CFG.expiryMin} minutes. Do not share with anyone. -SwasthyaAI`;
}

// ── Twilio ─────────────────────────────────────────────────
async function sendViaTwilio(mobile, message) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    logger.warn('Twilio not configured — falling back to console');
    logger.info(`[SMS-TWILIO-FALLBACK] To: ${mobile} | ${message}`);
    return { provider: 'twilio', success: false, fallback: true };
  }
  try {
    const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const msg = await twilio.messages.create({ body: message, from: TWILIO_PHONE_NUMBER, to: mobile });
    logger.info(`Twilio SMS sent: sid=${msg.sid} to=${mobile}`);
    return { provider: 'twilio', success: true, sid: msg.sid };
  } catch (err) {
    logger.error(`Twilio error: ${err.message}`);
    throw new AppError('Failed to send OTP via SMS. Please try again.', 503);
  }
}

// ── MSG91 ──────────────────────────────────────────────────
async function sendViaMSG91(mobile, otp, purpose) {
  const { MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_DLT_TE_ID } = process.env;
  if (!MSG91_AUTH_KEY) {
    logger.warn('MSG91 not configured — falling back to console');
    logger.info(`[SMS-MSG91-FALLBACK] To: ${mobile} | OTP: ${otp}`);
    return { provider: 'msg91', success: false, fallback: true };
  }
  try {
    const axios = require('axios');
    // MSG91 OTP API v5
    const response = await axios.post(
      'https://api.msg91.com/api/v5/otp',
      {
        template_id: MSG91_DLT_TE_ID,
        mobile: mobile.replace('+', ''),
        authkey: MSG91_AUTH_KEY,
        otp,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    logger.info(`MSG91 SMS sent: ${JSON.stringify(response.data)}`);
    return { provider: 'msg91', success: true, data: response.data };
  } catch (err) {
    logger.error(`MSG91 error: ${err.message}`);
    throw new AppError('Failed to send OTP via SMS. Please try again.', 503);
  }
}

// ── Fast2SMS ───────────────────────────────────────────────
async function sendViaFast2SMS(mobile, message) {
  const { FAST2SMS_API_KEY } = process.env;
  if (!FAST2SMS_API_KEY) {
    logger.warn('Fast2SMS not configured — falling back to console');
    logger.info(`[SMS-FAST2SMS-FALLBACK] To: ${mobile} | ${message}`);
    return { provider: 'fast2sms', success: false, fallback: true };
  }
  try {
    const axios = require('axios');
    const mobileClean = mobile.replace('+91', '').replace('+', '');
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      { route: 'q', message, numbers: mobileClean },
      { headers: { authorization: FAST2SMS_API_KEY } }
    );
    logger.info(`Fast2SMS response: ${JSON.stringify(response.data)}`);
    return { provider: 'fast2sms', success: response.data.return, data: response.data };
  } catch (err) {
    logger.error(`Fast2SMS error: ${err.message}`);
    throw new AppError('Failed to send OTP via SMS. Please try again.', 503);
  }
}

// ── Full OTP flow: generate → store → send ────────────────
async function initiateOTP(mobile, purpose) {
  await checkResendCooldown(mobile, purpose);
  const otp = generateOTP();
  const otpId = await storeOTP(mobile, purpose, otp);
  await sendOTP(mobile, otp, purpose);
  return {
    otpId,
    expiresInMinutes: CFG.expiryMin,
    cooldownSeconds: CFG.cooldownSec,
    maskedMobile: maskMobile(mobile),
  };
}

function maskMobile(mobile) {
  if (!mobile || mobile.length < 6) return '******';
  return mobile.slice(0, -6).replace(/./g, '*') + mobile.slice(-4);
}

module.exports = { generateOTP, storeOTP, verifyOTP, checkResendCooldown, sendOTP, initiateOTP, maskMobile };
