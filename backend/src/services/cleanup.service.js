const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Clean up expired, unverified OTPs from the database.
 * Run every 5 minutes via cron.
 */
async function cleanExpiredOTPs() {
  const result = await query(
    `DELETE FROM otp_logs
     WHERE verified = FALSE AND expires_at < NOW() - INTERVAL '1 hour'`
  );
  if (result.rowCount > 0) {
    logger.info(`OTP cleanup: removed ${result.rowCount} expired records`);
  }
}

/**
 * Mark scheduled appointments as no_show if they passed by > 15 minutes
 * and neither party joined. Run every hour.
 */
async function cleanExpiredSlots() {
  const result = await query(
    `UPDATE appointments
     SET status = 'no_show', updated_at = NOW()
     WHERE status IN ('scheduled', 'waiting')
       AND scheduled_at < NOW() - INTERVAL '15 minutes'`
  );
  if (result.rowCount > 0) {
    logger.info(`Slot cleanup: marked ${result.rowCount} appointments as no_show`);
  }
}

/**
 * Mark follow-up records as missed if due_date has passed
 */
async function cleanMissedFollowUps() {
  const result = await query(
    `UPDATE follow_up_records
     SET status = 'missed'
     WHERE status = 'pending' AND due_date < CURRENT_DATE`
  );
  if (result.rowCount > 0) {
    logger.info(`Follow-up cleanup: marked ${result.rowCount} as missed`);
  }
}

/**
 * Remove stale video rooms from Daily.co after 24 hours
 * (Jitsi and Twilio auto-clean; Daily needs explicit API call)
 */
async function cleanStaleVideoRooms() {
  if (process.env.VIDEO_PROVIDER !== 'daily' || !process.env.DAILY_API_KEY) return;
  try {
    const stale = await query(
      `SELECT video_room_name FROM appointments
       WHERE video_provider = 'daily'
         AND video_expires_at < NOW()
         AND video_room_name IS NOT NULL`
    );
    const { deleteVideoRoom } = require('./video.service');
    for (const row of stale.rows) {
      await deleteVideoRoom(row.video_room_name, 'daily');
    }
    if (stale.rowCount > 0) logger.info(`Video cleanup: removed ${stale.rowCount} stale Daily.co rooms`);
  } catch (err) {
    logger.warn('Video room cleanup error:', err.message);
  }
}

module.exports = { cleanExpiredOTPs, cleanExpiredSlots, cleanMissedFollowUps, cleanStaleVideoRooms };
