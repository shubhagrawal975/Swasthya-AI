const { query, withTransaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');

exports.createAssociation = async (req, res, next) => {
  try {
    const { name, description, type, geographic_scope, is_emergency, pandemic_name } = req.body;
    const assocId = uuidv4();
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO associations (id, name, description, type, created_by, geographic_scope, is_emergency, pandemic_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [assocId, name, description, type, req.user.id, geographic_scope, is_emergency || false, pandemic_name]
      );
      await client.query(
        `INSERT INTO association_members (association_id, doctor_id, role) VALUES ($1,$2,'admin')`,
        [assocId, req.user.id]
      );
    });
    res.status(201).json({ success: true, data: { association_id: assocId } });
  } catch (err) { next(err); }
};

exports.getAssociations = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*, COUNT(am.doctor_id) AS member_count,
              EXISTS(SELECT 1 FROM association_members WHERE association_id=a.id AND doctor_id=$1) AS is_member
       FROM associations a LEFT JOIN association_members am ON a.id=am.association_id
       WHERE a.is_active=TRUE GROUP BY a.id ORDER BY a.is_emergency DESC, a.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.joinAssociation = async (req, res, next) => {
  try {
    await query(
      `INSERT INTO association_members (association_id, doctor_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: 'Joined association' });
  } catch (err) { next(err); }
};
