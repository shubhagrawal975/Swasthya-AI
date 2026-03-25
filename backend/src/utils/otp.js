const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generateOTP(length = 6) {
  return crypto.randomInt(100000, 999999).toString();
}

async function hashOTP(otp) {
  return bcrypt.hash(otp, 10);
}

async function verifyOTP(otp, hash) {
  return bcrypt.compare(otp, hash);
}

module.exports = { generateOTP, hashOTP, verifyOTP };
