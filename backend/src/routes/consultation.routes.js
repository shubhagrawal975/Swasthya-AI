const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/consultation.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');

router.get('/messages/:appointment_id',  authenticate, ctrl.getConsultationMessages);
router.get('/follow-ups',                authenticate, authorize('patient'), ctrl.getFollowUps);
router.get('/patient/:patient_id/log',   authenticate, authorize('doctor'),  ctrl.getPatientConsultationLog);
router.get('/ratings/:doctor_id',        ctrl.getDoctorRatings);

router.post('/rate/:appointment_id', authenticate, authorize('patient'), [
  body('rating').isInt({ min: 1, max: 5 }),
], validate, ctrl.rateConsultation);

router.patch('/vitals/:appointment_id', authenticate, authorize('doctor'), ctrl.addVitals);

module.exports = router;
