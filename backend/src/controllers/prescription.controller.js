const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const AppError = require('../utils/AppError');
const { runWHOAutoCheck } = require('../services/whoReview.service');
const { sendEmail } = require('../services/email.service');
const { sendSMS } = require('../services/sms.service');

// ── Doctor: Create Prescription ───────────────
exports.createPrescription = async (req, res, next) => {
  try {
    const doctorId = req.user.id;
    const { patient_id, complaint, diagnosis, medicines, notes, follow_up_date } = req.body;

    // Verify patient exists
    const patientResult = await query('SELECT id, first_name, last_name, mobile FROM users WHERE id=$1', [patient_id]);
    if (!patientResult.rows[0]) return next(new AppError('Patient not found', 404));
    const patient = patientResult.rows[0];

    const prescId = uuidv4();
    const reviewId = uuidv4();

    await withTransaction(async (client) => {
      // 1. Create prescription (hidden from patient)
      await client.query(
        `INSERT INTO prescriptions (id, doctor_id, patient_id, complaint, diagnosis, medicines, notes, follow_up_date, status, is_visible_to_patient)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'submitted', FALSE)`,
        [prescId, doctorId, patient_id, complaint, diagnosis, JSON.stringify(medicines), notes, follow_up_date || null]
      );

      // 2. Create WHO review entry
      await client.query(
        `INSERT INTO who_reviews (id, prescription_id, assigned_at) VALUES ($1,$2,NOW())`,
        [reviewId, prescId]
      );

      // 3. Link review to prescription
      await client.query(`UPDATE prescriptions SET who_review_id=$1, status='who_check' WHERE id=$2`, [reviewId, prescId]);

      // 4. Audit log
      await client.query(
        'INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5,$6)',
        [doctorId, 'doctor', 'PRESCRIPTION_SUBMITTED', 'prescriptions', prescId, JSON.stringify({ patient_id, medicine_count: medicines.length })]
      );
    });

    // 5. Run automated WHO check (async — don't await for response)
    runWHOAutoCheck(prescId, medicines, patient).catch(err =>
      console.error('WHO auto-check error:', err)
    );

    res.status(201).json({
      success: true,
      message: 'Prescription submitted for WHO review. It will be visible to the patient after approval (avg. 2–4 hours).',
      data: {
        prescription_id: prescId,
        status: 'who_check',
        visible_to_patient: false,
        review_id: reviewId,
      },
    });
  } catch (err) { next(err); }
};

// ── Doctor: List own prescriptions ────────────
exports.getDoctorPrescriptions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [req.user.id, limit, offset];
    let where = 'p.doctor_id = $1';
    if (status) { where += ` AND p.status = $4`; params.push(status); }

    const result = await query(
      `SELECT p.id, p.complaint, p.diagnosis, p.medicines, p.notes, p.status, p.is_visible_to_patient,
              p.follow_up_date, p.created_at,
              u.first_name || ' ' || u.last_name AS patient_name, u.id AS patient_id,
              wr.action AS who_action, wr.reviewer_notes AS who_notes, wr.reviewed_at
       FROM prescriptions p
       JOIN users u ON p.patient_id = u.id
       LEFT JOIN who_reviews wr ON p.who_review_id = wr.id
       WHERE ${where}
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    const total = await query(`SELECT COUNT(*) FROM prescriptions WHERE doctor_id=$1`, [req.user.id]);

    res.json({
      success: true,
      data: {
        prescriptions: result.rows,
        pagination: { page: +page, limit: +limit, total: +total.rows[0].count },
      },
    });
  } catch (err) { next(err); }
};

// ── Patient: View own prescriptions (only approved) ──
exports.getPatientPrescriptions = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.id, p.complaint, p.diagnosis, p.medicines, p.notes, p.follow_up_date, p.published_at,
              p.status, d.first_name || ' ' || d.last_name AS doctor_name,
              d.specialization, d.mci_number
       FROM prescriptions p
       JOIN doctors d ON p.doctor_id = d.id
       WHERE p.patient_id = $1 AND p.is_visible_to_patient = TRUE AND p.status = 'published'
       ORDER BY p.published_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: { prescriptions: result.rows } });
  } catch (err) { next(err); }
};

// ── WHO Review Queue (Admin/Reviewer) ─────────
exports.getWHOReviewQueue = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT wr.id AS review_id, wr.prescription_id, wr.auto_check_passed, wr.auto_check_notes,
              wr.action, wr.flagged_medicines, wr.assigned_at,
              p.medicines, p.complaint, p.diagnosis, p.notes, p.status,
              d.first_name || ' ' || d.last_name AS doctor_name, d.specialization,
              u.first_name || ' ' || u.last_name AS patient_name
       FROM who_reviews wr
       JOIN prescriptions p ON wr.prescription_id = p.id
       JOIN doctors d ON p.doctor_id = d.id
       JOIN users u ON p.patient_id = u.id
       WHERE p.status IN ('who_check', 'board_review')
       ORDER BY wr.assigned_at ASC`
    );

    res.json({ success: true, data: { queue: result.rows, count: result.rows.length } });
  } catch (err) { next(err); }
};

// ── WHO Board: Approve/Flag/Reject ────────────
exports.reviewPrescription = async (req, res, next) => {
  try {
    const { review_id } = req.params;
    const { action, notes, flagged_medicines } = req.body;
    const reviewerId = req.user.id;

    const reviewResult = await query(
      'SELECT wr.*, p.patient_id, p.doctor_id FROM who_reviews wr JOIN prescriptions p ON wr.prescription_id = p.id WHERE wr.id=$1',
      [review_id]
    );
    if (!reviewResult.rows[0]) return next(new AppError('Review not found', 404));
    const review = reviewResult.rows[0];

    let newPrescStatus, isVisible = false, publishedAt = null;

    if (action === 'approve') {
      newPrescStatus = 'published';
      isVisible = true;
      publishedAt = new Date();
    } else if (action === 'flag') {
      newPrescStatus = 'flagged';
    } else if (action === 'reject') {
      newPrescStatus = 'rejected';
    } else if (action === 'request_revision') {
      newPrescStatus = 'flagged';
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE who_reviews SET reviewer_id=$1, action=$2, reviewer_notes=$3, flagged_medicines=$4, reviewed_at=NOW() WHERE id=$5`,
        [reviewerId, action, notes, flagged_medicines || [], review_id]
      );

      await client.query(
        `UPDATE prescriptions SET status=$1, is_visible_to_patient=$2, published_at=$3 WHERE id=$4`,
        [newPrescStatus, isVisible, publishedAt, review.prescription_id]
      );

      await client.query(
        'INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5,$6)',
        [reviewerId, req.user.role, `WHO_REVIEW_${action.toUpperCase()}`, 'prescriptions', review.prescription_id, JSON.stringify({ notes, flagged_medicines })]
      );
    });

    // Notify doctor and patient
    if (action === 'approve') {
      const patientRes = await query('SELECT mobile FROM users WHERE id=$1', [review.patient_id]);
      if (patientRes.rows[0]) {
        await sendSMS(patientRes.rows[0].mobile, 'SwasthyaAI: Your prescription has been reviewed and approved by the WHO-aligned Medical Board. Open your app to view it. 🏥');
      }
    } else if (action === 'flag' || action === 'request_revision') {
      const docRes = await query('SELECT mobile, email FROM doctors WHERE id=$1', [review.doctor_id]);
      if (docRes.rows[0]) {
        await sendSMS(docRes.rows[0].mobile, `SwasthyaAI: Your prescription (ID: ${review.prescription_id.slice(0,8)}...) was flagged by WHO review. Please revise and resubmit. Reason: ${notes}`);
      }
    }

    res.json({
      success: true,
      message: `Prescription ${action}d successfully`,
      data: { prescription_id: review.prescription_id, new_status: newPrescStatus },
    });
  } catch (err) { next(err); }
};
