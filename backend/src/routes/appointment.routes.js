const express = require('express');
const router = express.Router();
const { body, query: qv } = require('express-validator');
const ctrl = require('../controllers/appointment.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');

// Slots
router.get('/slots', ctrl.getAvailableSlots);

// Book
router.post('/', authenticate, authorize('patient'), [
  body('doctor_id').isUUID(),
  body('scheduled_at').isISO8601(),
  body('reason').trim().notEmpty(),
  body('type').optional().isIn(['video','audio','chat']),
], validate, ctrl.bookAppointment);

// Patient views
router.get('/my',       authenticate, authorize('patient'), ctrl.getPatientAppointments);
router.get('/history',  authenticate, authorize('patient'), ctrl.getConsultationHistory);

// Doctor views
router.get('/doctor',   authenticate, authorize('doctor'), ctrl.getDoctorAppointments);
router.get('/queue',    authenticate, authorize('doctor'), ctrl.getDoctorQueue);

// Detail (both)
router.get('/:id',          authenticate, ctrl.getAppointmentDetail);
router.patch('/:id/checkin',  authenticate, authorize('doctor'), ctrl.checkInAppointment);
router.patch('/:id/start',    authenticate, authorize('doctor'), ctrl.startConsultation);
router.patch('/:id/no-show',  authenticate, authorize('doctor'), ctrl.markNoShow);
router.patch('/:id/reschedule', authenticate, [
  body('new_scheduled_at').isISO8601(),
], validate, ctrl.rescheduleAppointment);
router.patch('/:id/cancel',     authenticate, ctrl.cancelAppointment);
router.patch('/:id/complete',   authenticate, authorize('doctor'), ctrl.completeConsultation);

module.exports = router;
