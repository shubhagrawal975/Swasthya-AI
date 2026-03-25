const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');

exports.createCamp = async (req, res, next) => {
  try {
    const { title, description, services, location, village, district, state, pincode,
            latitude, longitude, camp_date, start_time, end_time, max_patients } = req.body;
    const banner_image = req.file?.filename || null;
    const campId = uuidv4();
    await query(
      `INSERT INTO camps (id, doctor_id, title, description, services, location, village, district,
       state, pincode, latitude, longitude, camp_date, start_time, end_time, banner_image, max_patients, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'published')`,
      [campId, req.user.id, title, description, services, location, village, district,
       state, pincode, latitude, longitude, camp_date, start_time, end_time, banner_image, max_patients]
    );
    res.status(201).json({ success: true, data: { camp_id: campId } });
  } catch (err) { next(err); }
};

exports.getCamps = async (req, res, next) => {
  try {
    const { district, state, from_date } = req.query;
    let where = `c.status IN ('published','ongoing') AND c.camp_date >= CURRENT_DATE`;
    const params = [];
    if (district) { params.push(`%${district}%`); where += ` AND c.district ILIKE $${params.length}`; }
    const result = await query(
      `SELECT c.*, d.first_name||' '||d.last_name AS doctor_name, d.specialization
       FROM camps c JOIN doctors d ON c.doctor_id=d.id
       WHERE ${where} ORDER BY c.camp_date ASC LIMIT 50`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.registerForCamp = async (req, res, next) => {
  try {
    const { camp_id } = req.params;
    const camp = await query('SELECT id, max_patients, registrations FROM camps WHERE id=$1', [camp_id]);
    if (!camp.rows[0]) return next(new AppError('Camp not found', 404));
    if (camp.rows[0].max_patients && camp.rows[0].registrations >= camp.rows[0].max_patients)
      return next(new AppError('Camp is full', 400));
    await query(
      `INSERT INTO camp_registrations (camp_id, patient_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [camp_id, req.user.id]
    );
    await query(`UPDATE camps SET registrations=registrations+1 WHERE id=$1`, [camp_id]);
    res.json({ success: true, message: 'Registered for camp successfully' });
  } catch (err) { next(err); }
};

exports.getDoctorCamps = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, COUNT(cr.patient_id) AS registration_count
       FROM camps c LEFT JOIN camp_registrations cr ON c.id=cr.camp_id
       WHERE c.doctor_id=$1 GROUP BY c.id ORDER BY c.camp_date DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};
