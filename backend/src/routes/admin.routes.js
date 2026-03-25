const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminCtrl = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

router.get('/dashboard',          adminCtrl.getDashboard);
router.get('/doctors/pending',    adminCtrl.getPendingDoctors);
router.get('/users',              adminCtrl.getUsers);
router.get('/audit',              adminCtrl.getAuditLogs);
router.get('/audit/case/:case_id',adminCtrl.getAuditByCase);
router.get('/doctors/:doctor_id/history', adminCtrl.getDoctorVerificationHistory);

// Doctor verification workflow
router.patch('/doctors/:doctor_id/review', [
  body('action').isIn(['approve','reject','request_more_info','suspend']),
  body('notes').optional().trim(),
], validate, adminCtrl.reviewDoctor);

// WHO Prescription review
router.get('/who-queue',          adminCtrl.getWHOQueue);
router.patch('/who-review/:review_id', [
  body('action').isIn(['approve','flag','reject','request_revision']),
], validate, adminCtrl.reviewPrescription);

module.exports = router;
