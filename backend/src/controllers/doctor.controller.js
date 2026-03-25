const { query } = require('../config/database');
const AppError = require('../utils/AppError');

exports.getProfile = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, mobile, email, specialization, mci_number,
              hospital_affiliation, years_experience, bio, languages_spoken, district,
              state, verification_status, total_consultations, rating, profile_photo, created_at
       FROM doctors WHERE id=$1`,
      [req.user.id]
    );
    if (!result.rows[0]) return next(new AppError('Doctor not found', 404));
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { bio, years_experience, hospital_affiliation, languages_spoken } = req.body;
    const result = await query(
      `UPDATE doctors SET bio=$1, years_experience=$2, hospital_affiliation=$3,
              languages_spoken=$4, updated_at=NOW()
       WHERE id=$5 RETURNING id, first_name, last_name, bio`,
      [bio, years_experience, hospital_affiliation, languages_spoken, req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.getPatients = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.mobile, u.village, u.district,
              MAX(cs.created_at) AS last_contact
       FROM users u
       JOIN chat_sessions cs ON cs.patient_id = u.id
       WHERE cs.doctor_id = $1
       GROUP BY u.id ORDER BY last_contact DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const [patients, chats, rx, camps] = await Promise.all([
      query(`SELECT COUNT(DISTINCT patient_id) FROM chat_sessions WHERE doctor_id=$1`, [req.user.id]),
      query(`SELECT COUNT(*) FROM chat_sessions WHERE doctor_id=$1 AND status='open'`, [req.user.id]),
      query(`SELECT COUNT(*) FROM prescriptions WHERE doctor_id=$1 AND status IN ('who_check','board_review')`, [req.user.id]),
      query(`SELECT COUNT(*) FROM camps WHERE doctor_id=$1 AND camp_date >= CURRENT_DATE`, [req.user.id]),
    ]);
    res.json({
      success: true,
      data: {
        total_patients: +patients.rows[0].count,
        open_chats: +chats.rows[0].count,
        pending_who_review: +rx.rows[0].count,
        upcoming_camps: +camps.rows[0].count,
      },
    });
  } catch (err) { next(err); }
};

exports.listDoctors = async (req, res, next) => {
  try {
    const { specialization, district } = req.query;
    let where = `verification_status='verified' AND is_active=TRUE`;
    const params = [];
    if (specialization) { params.push(specialization); where += ` AND specialization ILIKE $${params.length}`; }
    if (district) { params.push(district); where += ` AND district ILIKE $${params.length}`; }

    const result = await query(
      `SELECT id, first_name, last_name, specialization, years_experience, district, state,
              hospital_affiliation, rating, languages_spoken, profile_photo
       FROM doctors WHERE ${where} ORDER BY rating DESC LIMIT 50`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getVerificationStatus = async (req, res, next) => {
  try {
    const doctorId = req.user.id;
    const doctorRes = await query(
      `SELECT id, verification_status, rejection_reason, verified_at, verified_by, mobile_verified, verification_status
       FROM doctors WHERE id=$1`,
      [doctorId]
    );
    if (!doctorRes.rows[0]) return next(new AppError('Doctor not found', 404));

    const historyRes = await query(
      `SELECT id, status, submitted_at, reviewed_at, reviewer_id, reviewer_notes, reason_code
       FROM doctor_verifications WHERE doctor_id=$1 ORDER BY created_at DESC LIMIT 10`,
      [doctorId]
    );

    res.json({
      success: true,
      data: {
        doctor: doctorRes.rows[0],
        verification_history: historyRes.rows,
      },
    });
  } catch (err) { next(err); }
};
