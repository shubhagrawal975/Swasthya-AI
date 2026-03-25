const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

exports.getMyPlans = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, title, description, category, tasks, progress, who_reviewed, is_active, start_date, end_date
       FROM health_plans WHERE patient_id=$1 AND is_active=TRUE ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.createPlan = async (req, res, next) => {
  try {
    const { title, description, category, tasks, start_date, end_date } = req.body;
    const planId = uuidv4();
    await query(
      `INSERT INTO health_plans (id, patient_id, title, description, category, tasks, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [planId, req.user.id, title, description, category, JSON.stringify(tasks || []), start_date, end_date]
    );
    res.status(201).json({ success: true, data: { plan_id: planId } });
  } catch (err) { next(err); }
};

exports.updateTaskCompletion = async (req, res, next) => {
  try {
    const { plan_id } = req.params;
    const { task_id, completed } = req.body;
    const plan = await query('SELECT tasks FROM health_plans WHERE id=$1 AND patient_id=$2', [plan_id, req.user.id]);
    if (!plan.rows[0]) return res.status(404).json({ success: false, message: 'Plan not found' });

    const tasks = plan.rows[0].tasks.map(t => t.id === task_id ? { ...t, completed } : t);
    const progress = Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);

    await query(
      `UPDATE health_plans SET tasks=$1, progress=$2, updated_at=NOW() WHERE id=$3`,
      [JSON.stringify(tasks), progress, plan_id]
    );
    // Update health score
    if (completed) await query('UPDATE users SET health_score=LEAST(100,health_score+1) WHERE id=$1', [req.user.id]);
    res.json({ success: true, data: { progress } });
  } catch (err) { next(err); }
};
