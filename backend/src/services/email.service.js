const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.SMTP_USER) {
      logger.warn(`[Email SKIPPED - no SMTP config] To: ${to} | Subject: ${subject}`);
      return;
    }
    await transporter.sendMail({
      from: `"SwasthyaAI" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to, subject, html,
    });
    logger.info(`Email sent to ${to}`);
  } catch (err) {
    logger.error('Email send error:', err.message);
  }
}

module.exports = { sendEmail };
