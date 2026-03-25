const { query, withTransaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');

// ── Get consultation messages for an appointment ──────────
exports.getConsultationMessages = async (req, res, next) => {
  try {
    const { appointment_id } = req.params;
    // Verify access
    const apptRes = await query('SELECT patient_id, doctor_id FROM appointments WHERE id=$1', [appointment_id]);
    if (!apptRes.rows[0]) return next(new AppError('Appointment not found', 404));
    const appt = apptRes.rows[0];
    const isAuth = appt.patient_id === req.user.id || appt.doctor_id === req.user.id;
    if (!isAuth) return next(new AppError('Not authorised', 403));

    const msgs = await query(
      `SELECT id, sender_id, sender_role, message, created_at
       FROM consultation_messages WHERE appointment_id=$1 ORDER BY created_at ASC`,
      [appointment_id]
    );
    res.json({ success: true, data: msgs.rows });
  } catch (err) { next(err); }
};

// ── Patient: rate a consultation ──────────────────────────
exports.rateConsultation = async (req, res, next) => {
  try {
    const { appointment_id } = req.params;
    const { rating, review_text, is_anonymous = false } = req.body;

    if (rating < 1 || rating > 5) return next(new AppError('Rating must be between 1 and 5', 400));

    const apptRes = await query(
      `SELECT id, patient_id, doctor_id, status FROM appointments WHERE id=$1`,
      [appointment_id]
    );
    const appt = apptRes.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));
    if (appt.patient_id !== req.user.id) return next(new AppError('Only the patient can rate this consultation', 403));
    if (appt.status !== 'completed') return next(new AppError('Can only rate completed consultations', 400));

    const ratingId = uuidv4();
    await query(
      `INSERT INTO consultation_ratings (id, appointment_id, patient_id, doctor_id, rating, review_text, is_anonymous)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (appointment_id, patient_id) DO UPDATE SET rating=$5, review_text=$6`,
      [ratingId, appointment_id, req.user.id, appt.doctor_id, rating, review_text, is_anonymous]
    );

    res.json({ success: true, message: 'Rating submitted. Thank you!', data: { rating_id: ratingId } });
  } catch (err) { next(err); }
};

// ── Get pending follow-ups for patient ────────────────────
exports.getFollowUps = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fr.*, a.scheduled_at AS original_date,
              d.first_name || ' ' || d.last_name AS doctor_name, d.specialization
       FROM follow_up_records fr
       JOIN appointments a ON fr.original_appointment = a.id
       JOIN doctors d ON fr.doctor_id = d.id
       WHERE fr.patient_id=$1 ORDER BY fr.due_date ASC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── Doctor: get full consultation log for a patient ───────
exports.getPatientConsultationLog = async (req, res, next) => {
  try {
    const { patient_id } = req.params;
    const result = await query(
      `SELECT cl.*, a.scheduled_at, a.type, a.reason,
              a.video_provider, a.status AS appointment_status
       FROM consultation_logs cl
       JOIN appointments a ON cl.appointment_id = a.id
       WHERE cl.doctor_id=$1 AND cl.patient_id=$2
       ORDER BY cl.created_at DESC`,
      [req.user.id, patient_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── Get doctor's ratings and reviews ─────────────────────
exports.getDoctorRatings = async (req, res, next) => {
  try {
    const { doctor_id } = req.params;
    const [avgRes, reviewsRes] = await Promise.all([
      query(`SELECT ROUND(AVG(rating)::numeric,2) AS avg_rating, COUNT(*) AS total FROM consultation_ratings WHERE doctor_id=$1`, [doctor_id]),
      query(
        `SELECT cr.rating, cr.review_text, cr.created_at,
                CASE WHEN cr.is_anonymous THEN 'Anonymous Patient' ELSE u.first_name || ' ' || u.last_name END AS patient_name
         FROM consultation_ratings cr
         JOIN users u ON cr.patient_id = u.id
         WHERE cr.doctor_id=$1 ORDER BY cr.created_at DESC LIMIT 20`,
        [doctor_id]
      ),
    ]);
    res.json({
      success: true,
      data: {
        average_rating: parseFloat(avgRes.rows[0].avg_rating) || 0,
        total_ratings: parseInt(avgRes.rows[0].total) || 0,
        reviews: reviewsRes.rows,
      },
    });
  } catch (err) { next(err); }
};

// ── Doctor: add vitals to a consultation ─────────────────
exports.addVitals = async (req, res, next) => {
  try {
    const { appointment_id } = req.params;
    const { bp, temperature, weight, height, spo2, pulse } = req.body;

    const vitals = { bp, temperature, weight, height, spo2, pulse, recorded_at: new Date() };

    await query(
      `UPDATE consultation_logs SET vitals=$1 WHERE appointment_id=$2 AND doctor_id=$3`,
      [JSON.stringify(vitals), appointment_id, req.user.id]
    );

    res.json({ success: true, message: 'Vitals recorded', data: { vitals } });
  } catch (err) { next(err); }
};
