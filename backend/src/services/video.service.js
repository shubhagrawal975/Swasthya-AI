/**
 * SwasthyaAI — Video Consultation Provider Adapter
 *
 * Supports: Jitsi (free/self-hosted) | Daily.co | Twilio Video
 * Configured via VIDEO_PROVIDER env var.
 *
 * Jitsi: Works immediately with no API key (uses meet.jit.si public server)
 * Daily/Twilio: Requires API keys for production use
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const PROVIDER = (process.env.VIDEO_PROVIDER || 'jitsi').toLowerCase();

/**
 * Create a video room and return join URLs for patient and doctor
 * @param {string} appointmentId
 * @param {object} participants - { patientName, doctorName }
 * @returns {{ roomName, patientUrl, doctorUrl, provider, expiresAt }}
 */
async function createVideoRoom(appointmentId, participants = {}) {
  switch (PROVIDER) {
    case 'daily':        return createDailyRoom(appointmentId, participants);
    case 'twilio_video': return createTwilioVideoRoom(appointmentId, participants);
    case 'jitsi':
    default:             return createJitsiRoom(appointmentId, participants);
  }
}

// ── Jitsi (free, no API key required for meet.jit.si) ─────
function createJitsiRoom(appointmentId, participants) {
  const domain = process.env.JITSI_DOMAIN || 'meet.jit.si';
  const roomName = `swasthya-${appointmentId.replace(/-/g, '').slice(0, 16)}`;

  // Optional: JWT auth if JITSI_APP_ID is set (for self-hosted Jitsi with auth)
  let jitsiJWT = null;
  if (process.env.JITSI_APP_ID && process.env.JITSI_APP_SECRET) {
    const jwt = require('jsonwebtoken');
    jitsiJWT = jwt.sign(
      { context: { user: { name: 'SwasthyaAI User' } }, aud: process.env.JITSI_APP_ID, iss: process.env.JITSI_APP_ID, sub: domain, room: roomName },
      process.env.JITSI_APP_SECRET,
      { expiresIn: '2h' }
    );
  }

  const baseUrl = `https://${domain}/${roomName}`;
  const configStr = '#config.startWithAudioMuted=false&config.startWithVideoMuted=false';

  const patientUrl = jitsiJWT ? `${baseUrl}?jwt=${jitsiJWT}${configStr}` : `${baseUrl}${configStr}`;
  const doctorUrl  = jitsiJWT ? `${baseUrl}?jwt=${jitsiJWT}${configStr}` : `${baseUrl}${configStr}`;

  logger.info(`Jitsi room created: ${roomName} on ${domain}`);

  return {
    provider: 'jitsi',
    room_name: roomName,
    domain,
    patient_url: patientUrl,
    doctor_url: doctorUrl,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
    webrtc_enabled: true,
  };
}

// ── Daily.co ───────────────────────────────────────────────
async function createDailyRoom(appointmentId, participants) {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    logger.warn('Daily API key not set — falling back to Jitsi');
    return createJitsiRoom(appointmentId, participants);
  }

  try {
    const axios = require('axios');
    const roomName = `swasthya-${appointmentId.replace(/-/g, '').slice(0, 20)}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 7200; // 2 hours

    // Create room
    const roomRes = await axios.post(
      'https://api.daily.co/v1/rooms',
      { name: roomName, privacy: 'private', properties: { exp: expiresAt, max_participants: 2 } },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    // Create meeting tokens for patient and doctor
    const [patientToken, doctorToken] = await Promise.all([
      axios.post('https://api.daily.co/v1/meeting-tokens',
        { properties: { room_name: roomName, user_name: participants.patientName || 'Patient', exp: expiresAt } },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      ),
      axios.post('https://api.daily.co/v1/meeting-tokens',
        { properties: { room_name: roomName, user_name: participants.doctorName || 'Doctor', is_owner: true, exp: expiresAt } },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      ),
    ]);

    const domain = process.env.DAILY_DOMAIN || `${roomName}.daily.co`;
    logger.info(`Daily.co room created: ${roomName}`);

    return {
      provider: 'daily',
      room_name: roomName,
      patient_url: `https://${process.env.DAILY_DOMAIN}/${roomName}?t=${patientToken.data.token}`,
      doctor_url:  `https://${process.env.DAILY_DOMAIN}/${roomName}?t=${doctorToken.data.token}`,
      expires_at: new Date(expiresAt * 1000),
      webrtc_enabled: true,
    };
  } catch (err) {
    logger.error(`Daily.co error: ${err.message}`);
    logger.warn('Falling back to Jitsi');
    return createJitsiRoom(appointmentId, participants);
  }
}

// ── Twilio Video ───────────────────────────────────────────
async function createTwilioVideoRoom(appointmentId, participants) {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const secret = process.env.TWILIO_VIDEO_API_KEY_SECRET;
  const keySid = process.env.TWILIO_VIDEO_API_KEY_SID;

  if (!sid || !secret || !keySid) {
    logger.warn('Twilio Video keys not set — falling back to Jitsi');
    return createJitsiRoom(appointmentId, participants);
  }

  try {
    const twilio = require('twilio');
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant  = AccessToken.VideoGrant;

    const roomName = `swasthya-${appointmentId.replace(/-/g, '').slice(0, 20)}`;

    // Create room via REST
    const client = twilio(sid, process.env.TWILIO_AUTH_TOKEN);
    await client.video.v1.rooms.create({ uniqueName: roomName, type: 'peer-to-peer', statusCallbackMethod: 'POST' });

    // Generate access tokens
    function makeToken(identity) {
      const token = new AccessToken(sid, keySid, secret, { ttl: 7200 });
      token.identity = identity;
      token.addGrant(new VideoGrant({ room: roomName }));
      return token.toJwt();
    }

    logger.info(`Twilio Video room created: ${roomName}`);

    return {
      provider: 'twilio_video',
      room_name: roomName,
      patient_token: makeToken(participants.patientName || 'Patient'),
      doctor_token:  makeToken(participants.doctorName  || 'Doctor'),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
      webrtc_enabled: true,
    };
  } catch (err) {
    logger.error(`Twilio Video error: ${err.message}`);
    return createJitsiRoom(appointmentId, participants);
  }
}

// ── Delete room (cleanup after consultation) ───────────────
async function deleteVideoRoom(roomName, provider) {
  if (provider === 'daily' && process.env.DAILY_API_KEY) {
    try {
      const axios = require('axios');
      await axios.delete(`https://api.daily.co/v1/rooms/${roomName}`,
        { headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` } }
      );
    } catch (err) { logger.warn(`Failed to delete Daily room: ${err.message}`); }
  }
  // Jitsi rooms auto-expire; Twilio rooms auto-close
}

module.exports = { createVideoRoom, deleteVideoRoom, PROVIDER };
