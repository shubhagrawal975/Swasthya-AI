const { query, withTransaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const { sendEmail } = require('../services/email.service');
const { sendSMS } = require('../services/sms.service');
const { notifyDoctor } = require('../sockets/socket');

// ── List all pending doctor verifications ─────────────────
exports.getPendingDoctors = async (req, res, next) => {
  try {
    const { status = 'pending' } = req.query;
    const result = await query(
      `SELECT d.id, d.first_name, d.last_name, d.mobile, d.email,
              d.specialization, d.mci_number, d.registration_authority,
              d.years_experience, d.hospital_affiliation, d.clinic_name,
              d.district, d.state, d.degree_certificate, d.mci_certificate,
              d.additional_docs, d.verification_status, d.created_at,
              dv.submitted_at, dv.reviewed_at, dv.reviewer_notes
       FROM doctors d
       LEFT JOIN doctor_verifications dv ON dv.doctor_id = d.id
       WHERE d.verification_status = $1
       ORDER BY d.created_at ASC`,
      [status]
    );
    res.json({ success: true, data: { doctors: result.rows, count: result.rows.length } });
  } catch (err) { next(err); }
};

// ── Review a doctor application ───────────────────────────
exports.reviewDoctor = async (req, res, next) => {
  try {
    const { doctor_id } = req.params;
    const { action, notes, rejection_reason } = req.body;
    // action: approve | reject | request_more_info

    const validActions = ['approve','reject','request_more_info','suspend'];
    if (!validActions.includes(action)) return next(new AppError(`Invalid action: ${action}`, 400));

    const docRes = await query(
      `SELECT id, first_name, last_name, mobile, email, verification_status FROM doctors WHERE id=$1`,
      [doctor_id]
    );
    if (!docRes.rows[0]) return next(new AppError('Doctor not found', 404));
    const doctor = docRes.rows[0];

    const statusMap = { approve: 'verified', reject: 'rejected', request_more_info: 'pending', suspend: 'suspended' };
    const newStatus = statusMap[action];

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE doctors SET verification_status=$1, verified_at=$2, verified_by=$3, rejection_reason=$4 WHERE id=$5`,
        [newStatus, action === 'approve' ? new Date() : null, req.user.id, rejection_reason || null, doctor_id]
      );

      await client.query(
        `UPDATE doctor_verifications SET status=$1, reviewed_at=NOW(), reviewer_id=$2, reviewer_notes=$3, reason_code=$4
         WHERE doctor_id=$5`,
        [newStatus, req.user.id, notes, rejection_reason, doctor_id]
      );

      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details)
         VALUES ($1,'admin',$2,'doctors',$3,$4)`,
        [req.user.id, `DOCTOR_${action.toUpperCase()}`, doctor_id, JSON.stringify({ notes, rejection_reason })]
      );
    });

    // Notify doctor via socket + SMS + email
    const messages = {
      approve:           `Congratulations Dr. ${doctor.last_name}! Your SwasthyaAI credentials have been verified. You can now log in to the Doctor Portal.`,
      reject:            `Your SwasthyaAI doctor application was not approved. Reason: ${rejection_reason || 'Not specified'}. Contact support@swasthya.ai`,
      request_more_info: `SwasthyaAI: Additional information required for your verification. ${notes || ''} Please log in to update your documents.`,
      suspend:           `Your SwasthyaAI doctor account has been suspended. Please contact support@swasthya.ai`,
    };

    notifyDoctor(doctor_id, 'verification_update', { status: newStatus, message: messages[action] });

    // SMS
    if (doctor.mobile) {
      const { sendSMSDirect } = require('../services/sms.service');
      await sendSMSDirect(doctor.mobile, messages[action]).catch(() => {});
    }

    // Email
    if (doctor.email) {
      const subjects = {
        approve: '✅ SwasthyaAI: Your credentials are verified!',
        reject:  '❌ SwasthyaAI: Doctor application not approved',
        request_more_info: '📋 SwasthyaAI: Additional documents required',
        suspend: '⚠️ SwasthyaAI: Account suspended',
      };
      await sendEmail(doctor.email, subjects[action],
        `<p>Dear Dr. ${doctor.first_name} ${doctor.last_name},</p><p>${messages[action]}</p>
         <p>Team SwasthyaAI | support@swasthya.ai</p>`
      );
    }

    res.json({
      success: true,
      message: `Doctor application ${action}d successfully`,
      data: { doctor_id, new_status: newStatus },
    });
  } catch (err) { next(err); }
};

// ── Dashboard stats ───────────────────────────────────────
exports.getDashboard = async (req, res, next) => {
  try {
    const [users, doctors, pending, appts, rxPending] = await Promise.all([
      query('SELECT COUNT(*) FROM users WHERE is_active=TRUE'),
      query("SELECT COUNT(*) FROM doctors WHERE verification_status='verified'"),
      query("SELECT COUNT(*) FROM doctors WHERE verification_status='pending'"),
      query("SELECT COUNT(*) FROM appointments WHERE DATE(scheduled_at)=CURRENT_DATE"),
      query("SELECT COUNT(*) FROM prescriptions WHERE status IN ('who_check','board_review')"),
    ]);
    res.json({
      success: true,
      data: {
        total_patients: +users.rows[0].count,
        verified_doctors: +doctors.rows[0].count,
        pending_verifications: +pending.rows[0].count,
        todays_appointments: +appts.rows[0].count,
        pending_rx_review: +rxPending.rows[0].count,
      },
    });
  } catch (err) { next(err); }
};

// ── WHO prescription review ───────────────────────────────
exports.getWHOQueue = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT wr.id AS review_id, wr.prescription_id, wr.auto_check_passed,
              wr.auto_check_notes, wr.action, wr.flagged_medicines, wr.assigned_at,
              p.medicines, p.complaint, p.diagnosis, p.notes, p.status, p.created_at,
              d.first_name||' '||d.last_name AS doctor_name, d.specialization, d.mci_number,
              u.first_name||' '||u.last_name AS patient_name, u.mobile AS patient_mobile
       FROM who_reviews wr
       JOIN prescriptions p ON wr.prescription_id = p.id
       JOIN doctors d ON p.doctor_id = d.id
       JOIN users u ON p.patient_id = u.id
       WHERE p.status IN ('who_check','board_review')
       ORDER BY wr.assigned_at ASC`
    );
    res.json({ success: true, data: { queue: result.rows, count: result.rows.length } });
  } catch (err) { next(err); }
};

exports.reviewPrescription = async (req, res, next) => {
  try {
    const { review_id } = req.params;
    const { action, notes, flagged_medicines, reason_code } = req.body;

    const validActions = ['approve','flag','reject','request_revision'];
    if (!validActions.includes(action)) return next(new AppError('Invalid action', 400));

    const reviewRes = await query(
      `SELECT wr.*, p.patient_id, p.doctor_id FROM who_reviews wr
       JOIN prescriptions p ON wr.prescription_id = p.id WHERE wr.id=$1`,
      [review_id]
    );
    if (!reviewRes.rows[0]) return next(new AppError('Review not found', 404));
    const review = reviewRes.rows[0];

    const statusMap = { approve: 'published', flag: 'flagged', reject: 'rejected', request_revision: 'flagged' };
    const newStatus  = statusMap[action];
    const isVisible  = action === 'approve';
    const publishedAt = action === 'approve' ? new Date() : null;

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE who_reviews SET reviewer_id=$1, action=$2, reviewer_notes=$3, flagged_medicines=$4,
         reason_code=$5, reviewed_at=NOW() WHERE id=$6`,
        [req.user.id, action, notes, flagged_medicines || [], reason_code, review_id]
      );
      await client.query(
        `UPDATE prescriptions SET status=$1, is_visible_to_patient=$2, published_at=$3, updated_at=NOW() WHERE id=$4`,
        [newStatus, isVisible, publishedAt, review.prescription_id]
      );
      await client.query(
        `INSERT INTO audit_logs (actor_id,actor_role,action,entity_type,entity_id,details)
         VALUES ($1,'admin',$2,'prescriptions',$3,$4)`,
        [req.user.id, `WHO_REVIEW_${action.toUpperCase()}`, review.prescription_id, JSON.stringify({ notes, flagged_medicines, reason_code })]
      );
    });

    // Notify patient if approved
    if (action === 'approve') {
      const patientRes = await query('SELECT mobile FROM users WHERE id=$1', [review.patient_id]);
      if (patientRes.rows[0]) {
        const { sendSMSDirect } = require('../services/sms.service');
        await sendSMSDirect(patientRes.rows[0].mobile,
          'SwasthyaAI: Your prescription has been reviewed and approved by the Medical Board. Open your app to view. 🏥'
        ).catch(() => {});
      }
    }

    // Notify doctor if flagged
    if (action === 'flag' || action === 'request_revision') {
      const docRes = await query('SELECT mobile, email FROM doctors WHERE id=$1', [review.doctor_id]);
      if (docRes.rows[0]) {
        const { sendSMSDirect } = require('../services/sms.service');
        await sendSMSDirect(docRes.rows[0].mobile,
          `SwasthyaAI: Prescription flagged by Medical Board. Reason: ${notes || reason_code}. Please revise.`
        ).catch(() => {});
        notifyDoctor(review.doctor_id, 'prescription_flagged', { prescription_id: review.prescription_id, notes, reason_code });
      }
    }

    res.json({
      success: true,
      message: `Prescription ${action}d successfully`,
      data: { prescription_id: review.prescription_id, new_status: newStatus, visible_to_patient: isVisible },
    });
  } catch (err) { next(err); }
};

// ── List all users ────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const result = await query(
      `SELECT id,first_name,last_name,mobile,email,village,district,state,preferred_lang,health_score,is_active,mobile_verified,created_at
       FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ success: true, data: { users: result.rows } });
  } catch (err) { next(err); }
};

exports.getDoctorVerificationHistory = async (req, res, next) => {
  try {
    const { doctor_id } = req.params;
    const result = await query(
      `SELECT id, doctor_id, status, submitted_at, reviewed_at, reviewer_id, reviewer_notes, reason_code, created_at
       FROM doctor_verifications WHERE doctor_id=$1 ORDER BY created_at DESC`,
      [doctor_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { case_type, action, page = 1, limit = 50 } = req.query;
    let where = 'TRUE';
    const params = [limit, (page - 1) * limit];
    if (case_type) { params.push(case_type); where += ` AND case_type=$${params.length + 1}`; }
    if (action) { params.push(action); where += ` AND action=$${params.length + 1}`; }
    const result = await query(
      `SELECT id, actor_id, actor_role, action, entity_type, entity_id, case_type, case_id, case_ref, details, ip_address, created_at
       FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ success: true, data: { logs: result.rows, count: result.rows.length } });
  } catch (err) { next(err); }
};

exports.getAuditByCase = async (req, res, next) => {
  try {
    const { case_id } = req.params;
    const result = await query(`SELECT * FROM audit_logs WHERE case_id=$1 ORDER BY created_at ASC`, [case_id]);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};
