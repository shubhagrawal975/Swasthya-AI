const logger = require('../utils/logger');
const PROVIDER = (process.env.SMS_PROVIDER || 'console').toLowerCase();

async function sendSMSDirect(to, body) {
  switch (PROVIDER) {
    case 'twilio':   return _twilio(to, body);
    case 'msg91':    return _msg91(to, body);
    case 'fast2sms': return _fast2sms(to, body);
    default:
      logger.info(`[SMS:console] To: ${to} | ${body}`);
      return { success: true, provider: 'console' };
  }
}
const sendSMS = sendSMSDirect;

async function _twilio(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID) { logger.warn(`[SMS:twilio-uncfg] ${to}`); return { success:false }; }
  try {
    const c = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const m = await c.messages.create({ body, from: TWILIO_PHONE_NUMBER, to });
    logger.info(`[SMS:twilio] sid=${m.sid} to=${to}`);
    return { success:true, sid: m.sid };
  } catch(e) { logger.error(`[SMS:twilio] ${e.message}`); return { success:false, error:e.message }; }
}
async function _msg91(to, body) {
  const { MSG91_AUTH_KEY, MSG91_SENDER_ID } = process.env;
  if (!MSG91_AUTH_KEY) { logger.warn(`[SMS:msg91-uncfg] ${to}`); return { success:false }; }
  try {
    const axios = require('axios');
    const mobile = to.replace('+91','').replace('+','');
    const r = await axios.get('https://api.msg91.com/api/sendhttp.php', { params:{ authkey:MSG91_AUTH_KEY, mobiles:mobile, message:body, sender:MSG91_SENDER_ID||'SWASTH', route:4, country:91 }});
    return { success:true, data:r.data };
  } catch(e) { logger.error(`[SMS:msg91] ${e.message}`); return { success:false, error:e.message }; }
}
async function _fast2sms(to, body) {
  const { FAST2SMS_API_KEY } = process.env;
  if (!FAST2SMS_API_KEY) { logger.warn(`[SMS:fast2sms-uncfg] ${to}`); return { success:false }; }
  try {
    const axios = require('axios');
    const mobile = to.replace('+91','').replace(/\D/g,'').slice(-10);
    const r = await axios.post('https://www.fast2sms.com/dev/bulkV2', { route:'q', message:body, numbers:mobile }, { headers:{ authorization: FAST2SMS_API_KEY }});
    return { success: r.data.return === true, data: r.data };
  } catch(e) { logger.error(`[SMS:fast2sms] ${e.message}`); return { success:false, error:e.message }; }
}

module.exports = { sendSMS, sendSMSDirect, PROVIDER };
