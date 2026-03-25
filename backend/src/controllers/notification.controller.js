const { query } = require('../config/database');

exports.getMyNotifications = async (req, res, next) => {
  try {
    const table  = req.user.role === 'doctor' ? 'doctor_id' : 'user_id';
    const result = await query(
      `SELECT id, title, body, type, data, is_read, priority, action_url, created_at
       FROM notifications WHERE ${table}=$1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = result.rows.filter(n => !n.is_read).length;
    res.json({ success: true, data: { notifications: result.rows, unread_count: unread } });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    const col = req.user.role === 'doctor' ? 'doctor_id' : 'user_id';
    await query(`UPDATE notifications SET is_read=TRUE WHERE id=$1 AND ${col}=$2`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const col = req.user.role === 'doctor' ? 'doctor_id' : 'user_id';
    await query(`UPDATE notifications SET is_read=TRUE WHERE ${col}=$1 AND is_read=FALSE`, [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};
