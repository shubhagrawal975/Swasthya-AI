const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');

exports.createSession = async (req, res, next) => {
  try {
    const { doctor_id, language = 'en' } = req.body;
    const sessionId = uuidv4();
    await query(
      `INSERT INTO chat_sessions (id, patient_id, doctor_id, is_ai_chat, language) VALUES ($1,$2,$3,FALSE,$4)`,
      [sessionId, req.user.id, doctor_id, language]
    );
    res.status(201).json({ success: true, data: { session_id: sessionId } });
  } catch (err) { next(err); }
};

exports.getSessions = async (req, res, next) => {
  try {
    let result;
    if (req.user.role === 'patient') {
      result = await query(
        `SELECT cs.id, cs.status, cs.language, cs.updated_at,
                d.first_name||' '||d.last_name AS other_name, d.specialization AS other_detail,
                (SELECT content FROM chat_messages WHERE session_id=cs.id ORDER BY created_at DESC LIMIT 1) AS last_message
         FROM chat_sessions cs LEFT JOIN doctors d ON cs.doctor_id=d.id
         WHERE cs.patient_id=$1 ORDER BY cs.updated_at DESC`,
        [req.user.id]
      );
    } else {
      result = await query(
        `SELECT cs.id, cs.status, cs.language, cs.updated_at,
                u.first_name||' '||u.last_name AS other_name, u.village AS other_detail,
                (SELECT content FROM chat_messages WHERE session_id=cs.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                (SELECT COUNT(*) FROM chat_messages WHERE session_id=cs.id AND is_read=FALSE AND sender_role='patient') AS unread_count
         FROM chat_sessions cs JOIN users u ON cs.patient_id=u.id
         WHERE cs.doctor_id=$1 ORDER BY cs.updated_at DESC`,
        [req.user.id]
      );
    }
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { session_id } = req.params;
    const result = await query(
      `SELECT id, sender_role, content, type, metadata, is_read, created_at
       FROM chat_messages WHERE session_id=$1 ORDER BY created_at ASC`,
      [session_id]
    );
    // Mark as read
    await query(
      `UPDATE chat_messages SET is_read=TRUE WHERE session_id=$1 AND sender_role!=$2`,
      [session_id, req.user.role === 'doctor' ? 'doctor' : 'patient']
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { session_id } = req.params;
    const { content, type = 'text' } = req.body;
    const msgId = uuidv4();
    const role = req.user.role === 'doctor' ? 'doctor' : 'patient';
    await query(
      `INSERT INTO chat_messages (id, session_id, sender_id, sender_role, content, type) VALUES ($1,$2,$3,$4,$5,$6)`,
      [msgId, session_id, req.user.id, role, content, type]
    );
    await query(`UPDATE chat_sessions SET updated_at=NOW() WHERE id=$1`, [session_id]);
    res.status(201).json({ success: true, data: { message_id: msgId } });
  } catch (err) { next(err); }
};
