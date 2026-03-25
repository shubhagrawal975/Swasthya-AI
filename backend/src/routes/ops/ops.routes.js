const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const ctrl = require('../../controllers/ops/ops.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate');

router.use(authenticate);

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard', ctrl.getOpsDashboard);

// ── Medical Coding Cases ──────────────────────────────────────────────────
router.post('/coding',
  authorize('doctor','admin'),
  [body('clinical_notes').trim().isLength({ min: 20 }).withMessage('Clinical notes required (min 20 chars)')],
  validate,
  ctrl.createCodingCase
);
router.get('/coding',              ctrl.getCodingCases);
router.get('/coding/:id',          ctrl.getCodingCaseById);
router.patch('/coding/:id/review',
  authorize('admin','doctor'),
  [
    body('action').isIn(['approved','rejected','overridden','needs_revision']),
    body('notes').optional().trim(),
  ],
  validate,
  ctrl.reviewCodingCase
);

// ── Prior Authorization Cases ──────────────────────────────────────────────
router.post('/prior-auth',
  authorize('doctor','admin'),
  [body('diagnosis').trim().notEmpty().withMessage('Diagnosis is required')],
  validate,
  ctrl.createPriorAuthCase
);
router.get('/prior-auth',             ctrl.getPriorAuthCases);
router.get('/prior-auth/:id',         ctrl.getPriorAuthCaseById);
router.patch('/prior-auth/:id/review',
  authorize('admin','doctor'),
  [
    body('action').isIn(['approved','denied','more_info_requested','escalated','closed']),
    body('justification').trim().isLength({ min: 10 }).withMessage('Justification mandatory (min 10 chars)'),
  ],
  validate,
  ctrl.reviewPriorAuthCase
);

// ── Decision Cases ─────────────────────────────────────────────────────────
router.post('/decision',
  [body('clinical_summary').trim().notEmpty()],
  validate,
  ctrl.createDecisionCase
);
router.patch('/decision/:id/review',
  authorize('admin','doctor'),
  [body('justification').trim().isLength({ min: 10 })],
  validate,
  ctrl.reviewDecisionCase
);

// ── Compliance Audit Console ───────────────────────────────────────────────
router.get('/audit',                   ctrl.getAuditLog);
router.get('/audit/:id',               ctrl.getAuditEntry);
router.get('/audit/case/:case_id',     ctrl.getFullCaseAudit);

module.exports = router;
