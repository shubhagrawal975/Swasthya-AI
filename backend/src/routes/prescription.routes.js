// prescription.routes.js
const express = require('express');
const router = express.Router();
const prescCtrl = require('../controllers/prescription.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.post('/', authenticate, authorize('doctor'), prescCtrl.createPrescription);
router.get('/doctor', authenticate, authorize('doctor'), prescCtrl.getDoctorPrescriptions);
router.get('/patient', authenticate, authorize('patient'), prescCtrl.getPatientPrescriptions);
router.get('/who-queue', authenticate, authorize('admin', 'who_reviewer'), prescCtrl.getWHOReviewQueue);
router.patch('/who-review/:review_id', authenticate, authorize('admin', 'who_reviewer'), prescCtrl.reviewPrescription);

module.exports = router;
