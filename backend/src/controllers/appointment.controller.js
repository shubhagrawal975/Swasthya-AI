const { query, withTransaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const { createVideoRoom, deleteVideoRoom } = require('../services/video.service');
const { notifyUser, notifyDoctor, broadcastQueueUpdate } = require('../sockets/socket');
const { sendEmail } = require('../services/email.service');
const logger = require('../utils/logger');

// ── Get available slots for a doctor ─────────────────────
exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { doctor_id, date } = req.query;
    if (!doctor_id || !date) return next(new AppError('doctor_id and date are required', 400));

    // Get doctor's schedule config
    const docRes = await query(
      `SELECT id, first_name, last_name, specialization, consultation_duration_min, is_available
       FROM doctors WHERE id=$1 AND verification_status='verified'`,
      [doctor_id]
    );
    if (!docRes.rows[0]) return next(new AppError('Doctor not found or not verified', 404));
    const doctor = docRes.rows[0];

    // Get already booked slots for that date
    const bookedRes = await query(
      `SELECT scheduled_at, duration_minutes FROM appointments
       WHERE doctor_id=$1 AND DATE(scheduled_at)=$2
       AND status NOT IN ('cancelled','rejected','no_show')`,
      [doctor_id, date]
    );

    const bookedTimes = bookedRes.rows.map(r => new Date(r.scheduled_at).toISOString());

    // Generate all possible slots (9 AM – 6 PM, every 30 min)
    const slotDuration = doctor.consultation_duration_min || 30;
    const slots = [];
    const targetDate = new Date(date);

    for (let hour = 9; hour < 18; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        const slotTime = new Date(targetDate);
        slotTime.setHours(hour, min, 0, 0);

        if (slotTime <= new Date()) continue; // Skip past slots

        const isBooked = bookedTimes.some(bt => {
          const diff = Math.abs(new Date(bt) - slotTime);
          return diff < slotDuration * 60 * 1000;
        });

        slots.push({
          time: slotTime.toISOString(),
          display: slotTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
          available: !isBooked,
          duration_minutes: slotDuration,
        });
      }
    }

    res.json({
      success: true,
      data: {
        doctor: { id: doctor.id, name: `Dr. ${doctor.first_name} ${doctor.last_name}`, specialization: doctor.specialization },
        date,
        slots,
        is_available: doctor.is_available,
      },
    });
  } catch (err) { next(err); }
};

// ── Book appointment ──────────────────────────────────────
exports.bookAppointment = async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const { doctor_id, scheduled_at, reason, type = 'video', language = 'en' } = req.body;

    // Check doctor exists and is verified
    const docRes = await query(
      `SELECT id, first_name, last_name, specialization, email, mobile, consultation_duration_min
       FROM doctors WHERE id=$1 AND verification_status='verified' AND is_active=TRUE`,
      [doctor_id]
    );
    if (!docRes.rows[0]) return next(new AppError('Doctor not found or not verified', 404));
    const doctor = docRes.rows[0];

    // Check slot is not already taken
    const conflict = await query(
      `SELECT id FROM appointments
       WHERE doctor_id=$1 AND scheduled_at=$2
       AND status NOT IN ('cancelled','rejected','no_show')`,
      [doctor_id, scheduled_at]
    );
    if (conflict.rows.length) return next(new AppError('This slot is already booked. Please choose another time.', 409));

    // Check patient doesn't already have active appointment with same doctor same day
    const patientConflict = await query(
      `SELECT id FROM appointments
       WHERE patient_id=$1 AND doctor_id=$2 AND DATE(scheduled_at)=DATE($3::timestamptz)
       AND status NOT IN ('cancelled','rejected','no_show','completed')`,
      [patientId, doctor_id, scheduled_at]
    );
    if (patientConflict.rows.length) return next(new AppError('You already have an appointment with this doctor today.', 409));

    const appointmentId = uuidv4();
    const duration = doctor.consultation_duration_min || 30;

    // Create video room
    const patientRes = await query('SELECT first_name, last_name FROM users WHERE id=$1', [patientId]);
    const patient = patientRes.rows[0];

    const videoRoom = await createVideoRoom(appointmentId, {
      patientName: `${patient.first_name} ${patient.last_name}`,
      doctorName:  `Dr. ${doctor.first_name} ${doctor.last_name}`,
    });

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO appointments
         (id, patient_id, doctor_id, scheduled_at, duration_minutes, reason, type, language,
          status, video_room_name, video_patient_url, video_doctor_url, video_provider, video_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,$10,$11,$12,$13)`,
        [
          appointmentId, patientId, doctor_id, scheduled_at, duration, reason, type, language,
          videoRoom.room_name, videoRoom.patient_url, videoRoom.doctor_url,
          videoRoom.provider, videoRoom.expires_at,
        ]
      );

      // Create notification
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, data)
         VALUES ($1,$2,$3,'appointment_booked',$4)`,
        [patientId, 'Appointment Confirmed',
         `Your appointment with Dr. ${doctor.last_name} on ${new Date(scheduled_at).toLocaleString('en-IN')} is confirmed.`,
         JSON.stringify({ appointment_id: appointmentId })]
      );

      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details)
         VALUES ($1,'patient','APPOINTMENT_BOOKED','appointments',$2,$3)`,
        [patientId, appointmentId, JSON.stringify({ doctor_id, scheduled_at, type })]
      );
    });

    // Notify doctor in real-time
    notifyDoctor(doctor_id, 'new_appointment', {
      appointment_id: appointmentId,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      scheduled_at, reason,
    });

    // Send confirmation email
    if (patient && doctor.email) {
      await sendEmail(doctor.email, 'New Appointment Booking — SwasthyaAI',
        `<h2>New appointment booked</h2>
         <p><strong>Patient:</strong> ${patient.first_name} ${patient.last_name}</p>
         <p><strong>When:</strong> ${new Date(scheduled_at).toLocaleString('en-IN')}</p>
         <p><strong>Reason:</strong> ${reason || 'Not specified'}</p>
         <p><strong>Type:</strong> ${type}</p>`
      );
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        appointment_id: appointmentId,
        scheduled_at,
        duration_minutes: duration,
        video_room: {
          provider: videoRoom.provider,
          patient_url: videoRoom.patient_url,
          expires_at: videoRoom.expires_at,
        },
        status: 'scheduled',
      },
    });
  } catch (err) { next(err); }
};

// ── Patient: get my appointments ──────────────────────────
exports.getPatientAppointments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'a.patient_id=$1';
    const params = [req.user.id, limit, offset];
    if (status) { where += ' AND a.status=$4'; params.push(status); }

    const result = await query(
      `SELECT a.id, a.scheduled_at, a.duration_minutes, a.reason, a.type, a.status,
              a.video_patient_url, a.video_provider, a.video_expires_at,
              a.started_at, a.ended_at, a.doctor_notes, a.follow_up_date, a.created_at,
              d.first_name || ' ' || d.last_name AS doctor_name,
              d.specialization, d.profile_photo AS doctor_photo
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE ${where}
       ORDER BY a.scheduled_at DESC LIMIT $2 OFFSET $3`,
      params
    );

    res.json({ success: true, data: { appointments: result.rows } });
  } catch (err) { next(err); }
};

// ── Doctor: get my appointments ───────────────────────────
exports.getDoctorAppointments = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'a.doctor_id=$1';
    const params = [req.user.id, limit, offset];
    if (status) { where += ` AND a.status=$${params.length+1}`; params.push(status); }
    if (date)   { where += ` AND DATE(a.scheduled_at)=$${params.length+1}`; params.push(date); }

    const result = await query(
      `SELECT a.id, a.scheduled_at, a.duration_minutes, a.reason, a.type, a.status,
              a.video_doctor_url, a.video_provider, a.video_expires_at,
              a.started_at, a.ended_at, a.doctor_notes, a.follow_up_date, a.created_at,
              u.first_name || ' ' || u.last_name AS patient_name,
              u.mobile AS patient_mobile, u.village, u.preferred_lang
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       WHERE ${where}
       ORDER BY a.scheduled_at ASC LIMIT $2 OFFSET $3`,
      params
    );

    res.json({ success: true, data: { appointments: result.rows } });
  } catch (err) { next(err); }
};

// ── Get queue (today's waiting appointments) ──────────────
exports.getDoctorQueue = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.id, a.scheduled_at, a.status, a.reason, a.type, a.created_at,
              u.first_name || ' ' || u.last_name AS patient_name,
              u.mobile, u.village, u.preferred_lang,
              RANK() OVER (ORDER BY a.scheduled_at) AS queue_position
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       WHERE a.doctor_id=$1 AND DATE(a.scheduled_at)=CURRENT_DATE
       AND a.status IN ('scheduled','waiting','in_progress')
       ORDER BY a.scheduled_at ASC`,
      [req.user.id]
    );

    res.json({ success: true, data: { queue: result.rows, count: result.rows.length } });
  } catch (err) { next(err); }
};

exports.checkInAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const apptRes = await query('SELECT * FROM appointments WHERE id=$1 AND doctor_id=$2', [id, req.user.id]);
    const appt = apptRes.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));
    if (!['scheduled'].includes(appt.status)) return next(new AppError('Only scheduled appointments can be checked in', 400));
    await query('UPDATE appointments SET status=$1, waiting_at=NOW(), updated_at=NOW() WHERE id=$2', ['waiting', id]);
    res.json({ success: true, message: 'Patient checked in and moved to waiting list', data: { appointment_id: id, status: 'waiting' } });
  } catch (err) { next(err); }
};

exports.startConsultation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const apptRes = await query('SELECT * FROM appointments WHERE id=$1 AND doctor_id=$2', [id, req.user.id]);
    const appt = apptRes.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));
    if (!['scheduled','waiting'].includes(appt.status)) return next(new AppError('Only scheduled or waiting appointments can be started', 400));
    await query('UPDATE appointments SET status=$1, started_at=COALESCE(started_at,NOW()), updated_at=NOW() WHERE id=$2', ['in_progress', id]);
    res.json({ success: true, message: 'Consultation started', data: { appointment_id: id, status: 'in_progress' } });
  } catch (err) { next(err); }
};

exports.markNoShow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const apptRes = await query('SELECT * FROM appointments WHERE id=$1 AND doctor_id=$2', [id, req.user.id]);
    const appt = apptRes.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));
    if (!['scheduled','waiting'].includes(appt.status)) return next(new AppError('Only scheduled or waiting appointments can be marked no-show', 400));
    await query('UPDATE appointments SET status=$1, updated_at=NOW() WHERE id=$2', ['no_show', id]);
    await query(`INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details) VALUES ($1,$2,'APPOINTMENT_NO_SHOW','appointments',$3,$4)`, [req.user.id, req.user.role, id, JSON.stringify({ reason: 'No show by patient' })]);
    res.json({ success: true, message: 'Patient marked as no-show', data: { appointment_id: id, status: 'no_show' } });
  } catch (err) { next(err); }
};

// ── Reschedule appointment ────────────────────────────────
exports.rescheduleAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_scheduled_at, reason } = req.body;

    const apptRes = await query(
      `SELECT a.*, u.first_name || ' ' || u.last_name AS patient_name,
              d.first_name || ' ' || d.last_name AS doctor_name,
              d.email AS doctor_email
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id=$1`, [id]
    );
    const appt = apptRes.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));

    // Authorise
    const isOwner = appt.patient_id === req.user.id || appt.doctor_id === req.user.id;
    if (!isOwner) return next(new AppError('Not authorised', 403));
    if (!['scheduled','waiting'].includes(appt.status)) {
      return next(new AppError(`Cannot reschedule appointment in status: ${appt.status}`, 400));
    }

    // Check new slot availability
    const conflict = await query(
      `SELECT id FROM appointments WHERE doctor_id=$1 AND scheduled_at=$2 AND id!=$3
       AND status NOT IN ('cancelled','rejected','no_show')`,
      [appt.doctor_id, new_scheduled_at, id]
    );
    if (conflict.rows.length) return next(new AppError('New slot is already taken', 409));

    await withTransaction(async (client) => {
      // Create video room for new time
      const videoRoom = await createVideoRoom(id, { patientName: appt.patient_name, doctorName: appt.doctor_name });

      await client.query(
        `UPDATE appointments SET
           scheduled_at=$1, status='scheduled', reschedule_reason=$2, rescheduled_by=$3,
           video_room_name=$4, video_patient_url=$5, video_doctor_url=$6,
           video_provider=$7, video_expires_at=$8, updated_at=NOW()
         WHERE id=$9`,
        [new_scheduled_at, reason, req.user.role, videoRoom.room_name,
         videoRoom.patient_url, videoRoom.doctor_url, videoRoom.provider, videoRoom.expires_at, id]
      );

      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details)
         VALUES ($1,$2,'APPOINTMENT_RESCHEDULED','appointments',$3,$4)`,
        [req.user.id, req.user.role, id, JSON.stringify({ old: appt.scheduled_at, new: new_scheduled_at, reason })]
      );
    });

    // Notify both parties
    notifyUser(appt.patient_id, 'appointment_rescheduled', { appointment_id: id, new_scheduled_at });
    notifyDoctor(appt.doctor_id, 'appointment_rescheduled', { appointment_id: id, new_scheduled_at });

    res.json({ success: true, message: 'Appointment rescheduled successfully', data: { appointment_id: id, new_scheduled_at } });
  } catch (err) { next(err); }
};

// ── Cancel appointment ────────────────────────────────────
exports.cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const apptRes = await query('SELECT * FROM appointments WHERE id=$1', [id]);
    const appt = apptRes.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));

    const isOwner = appt.patient_id === req.user.id || appt.doctor_id === req.user.id;
    if (!isOwner) return next(new AppError('Not authorised', 403));
    if (['completed','cancelled','rejected'].includes(appt.status)) {
      return next(new AppError(`Cannot cancel appointment in status: ${appt.status}`, 400));
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE appointments SET status='cancelled', cancellation_reason=$1, cancelled_by=$2, updated_at=NOW() WHERE id=$3`,
        [reason, req.user.role, id]
      );
      await client.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details)
         VALUES ($1,$2,'APPOINTMENT_CANCELLED','appointments',$3,$4)`,
        [req.user.id, req.user.role, id, JSON.stringify({ reason })]
      );
    });

    // Notify both
    notifyUser(appt.patient_id, 'appointment_cancelled', { appointment_id: id, reason });
    notifyDoctor(appt.doctor_id, 'appointment_cancelled', { appointment_id: id, reason });

    // Cleanup video room
    if (appt.video_room_name) {
      deleteVideoRoom(appt.video_room_name, appt.video_provider).catch(() => {});
    }

    res.json({ success: true, message: 'Appointment cancelled', data: { appointment_id: id } });
  } catch (err) { next(err); }
};

// ── Complete consultation + add notes + follow-up ─────────
exports.completeConsultation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { doctor_notes, diagnosis, prescription_id, follow_up_date, follow_up_notes } = req.body;
    if (req.user.role !== 'doctor') return next(new AppError('Only doctors can complete consultations', 403));

    const apptRes = await query('SELECT * FROM appointments WHERE id=$1 AND doctor_id=$2', [id, req.user.id]);
    if (!apptRes.rows[0]) return next(new AppError('Appointment not found', 404));

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE appointments SET
           status='completed', ended_at=COALESCE(ended_at,NOW()), doctor_notes=$1,
           diagnosis=$2, prescription_id=$3, follow_up_date=$4, follow_up_notes=$5, updated_at=NOW()
         WHERE id=$6`,
        [doctor_notes, diagnosis, prescription_id || null, follow_up_date || null, follow_up_notes, id]
      );

      // Create consultation log
      const logId = uuidv4();
      await client.query(
        `INSERT INTO consultation_logs
         (id, appointment_id, doctor_id, patient_id, notes, diagnosis, duration_minutes, follow_up_date, follow_up_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [logId, id, req.user.id, apptRes.rows[0].patient_id, doctor_notes, diagnosis,
         apptRes.rows[0].duration_minutes, follow_up_date, follow_up_notes]
      );

      // Notification to patient
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, data)
         VALUES ($1,$2,$3,'consultation_completed',$4)`,
        [apptRes.rows[0].patient_id, 'Consultation Completed',
         follow_up_date ? `Your follow-up is scheduled for ${follow_up_date}` : 'Your consultation is complete.',
         JSON.stringify({ appointment_id: id, follow_up_date })]
      );

      // Update doctor consultation count
      await client.query(`UPDATE doctors SET total_consultations=total_consultations+1 WHERE id=$1`, [req.user.id]);
    });

    notifyUser(apptRes.rows[0].patient_id, 'consultation_completed', { appointment_id: id, follow_up_date });

    res.json({ success: true, message: 'Consultation completed', data: { appointment_id: id, follow_up_date } });
  } catch (err) { next(err); }
};

// ── Get consultation history for patient ──────────────────
exports.getConsultationHistory = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.id, a.scheduled_at, a.ended_at, a.duration_minutes, a.reason,
              a.doctor_notes, a.diagnosis, a.follow_up_date, a.follow_up_notes, a.status,
              cl.notes AS consultation_notes,
              d.first_name || ' ' || d.last_name AS doctor_name,
              d.specialization, d.profile_photo
       FROM appointments a
       LEFT JOIN consultation_logs cl ON cl.appointment_id = a.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id=$1 AND a.status='completed'
       ORDER BY a.ended_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── Get single appointment detail (includes video URLs) ───
exports.getAppointmentDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, 
              u.first_name || ' ' || u.last_name AS patient_name, u.mobile AS patient_mobile, u.preferred_lang,
              d.first_name || ' ' || d.last_name AS doctor_name, d.specialization, d.email AS doctor_email
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id=$1`, [id]
    );
    const appt = result.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));

    // Authorise
    const isPatient = appt.patient_id === req.user.id;
    const isDoctor  = appt.doctor_id  === req.user.id;
    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return next(new AppError('Not authorised', 403));
    }

    // Return appropriate video URL based on role
    const videoUrl = isDoctor ? appt.video_doctor_url : appt.video_patient_url;

    res.json({
      success: true,
      data: {
        ...appt,
        video_url: videoUrl,
        video_patient_url: undefined,
        video_doctor_url: undefined,
      },
    });
  } catch (err) { next(err); }
};

// ── Video routes handler ──────────────────────────────────
exports.getVideoToken = async (req, res, next) => {
  try {
    const { appointment_id } = req.params;
    const result = await query(
      `SELECT a.*, u.first_name || ' ' || u.last_name AS patient_name,
              d.first_name || ' ' || d.last_name AS doctor_name
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id=$1`, [appointment_id]
    );
    const appt = result.rows[0];
    if (!appt) return next(new AppError('Appointment not found', 404));

    const isPatient = appt.patient_id === req.user.id;
    const isDoctor  = appt.doctor_id  === req.user.id;
    if (!isPatient && !isDoctor) return next(new AppError('Not authorised', 403));

    const url = isDoctor ? appt.video_doctor_url : appt.video_patient_url;

    res.json({
      success: true,
      data: {
        video_url: url,
        provider: appt.video_provider,
        room_name: appt.video_room_name,
        expires_at: appt.video_expires_at,
      },
    });
  } catch (err) { next(err); }
};
