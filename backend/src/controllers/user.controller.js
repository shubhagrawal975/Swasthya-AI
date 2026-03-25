const { query } = require('../config/database');
const AppError = require('../utils/AppError');

exports.getProfile = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, mobile, email, village, district, state,
              preferred_lang, health_score, streak_days, profile_photo, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return next(new AppError('User not found', 404));
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { first_name, last_name, email, village, district, state, preferred_lang, date_of_birth, gender } = req.body;
    const result = await query(
      `UPDATE users SET first_name=$1, last_name=$2, email=$3, village=$4, district=$5,
              state=$6, preferred_lang=$7, date_of_birth=$8, gender=$9, updated_at=NOW()
       WHERE id=$10 RETURNING id, first_name, last_name, email, preferred_lang`,
      [first_name, last_name, email, village, district, state, preferred_lang, date_of_birth, gender, req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, title, body, type, is_read, created_at FROM notifications
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.getDoctorUpdates = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.id, a.topic, a.type, a.content, a.severity, a.pushed_at,
              d.first_name||' '||d.last_name AS doctor_name
       FROM ai_advertisements a
       JOIN doctors d ON a.created_by = d.id
       WHERE a.is_live = TRUE
       ORDER BY a.pushed_at DESC LIMIT 20`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};
