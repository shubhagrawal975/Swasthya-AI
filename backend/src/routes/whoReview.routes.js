// whoReview.routes.js
const express = require('express');
const r = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const prescCtrl = require('../controllers/prescription.controller');
r.get('/queue', authenticate, authorize('admin', 'who_reviewer'), prescCtrl.getWHOReviewQueue);
r.patch('/:review_id', authenticate, authorize('admin', 'who_reviewer'), prescCtrl.reviewPrescription);
module.exports = r;
