import api from './api';

export const appointmentAPI = {
  getSlots:           (doctorId, date) => api.get('/appointments/slots', { params: { doctor_id: doctorId, date } }),
  book:               (data)           => api.post('/appointments', data),
  getMyAppts:         (params)         => api.get('/appointments/my', { params }),
  getHistory:         ()               => api.get('/appointments/history'),
  getQueue:           ()               => api.get('/appointments/queue'),
  getDoctorAppts:     (params)         => api.get('/appointments/doctor', { params }),
  getDetail:          (id)             => api.get(`/appointments/${id}`),
  checkIn:            (id)             => api.patch(`/appointments/${id}/checkin`),
  start:              (id)             => api.patch(`/appointments/${id}/start`),
  markNoShow:         (id)             => api.patch(`/appointments/${id}/no-show`),
  reschedule:         (id, data)       => api.patch(`/appointments/${id}/reschedule`, data),
  cancel:             (id, reason)     => api.patch(`/appointments/${id}/cancel`, { reason }),
  complete:           (id, data)       => api.patch(`/appointments/${id}/complete`, data),
  getVideoToken:      (appointmentId)  => api.get(`/video/token/${appointmentId}`),
  rate:               (id, data)       => api.post(`/consultations/rate/${id}`, data),
  getFollowUps:       ()               => api.get('/consultations/follow-ups'),
  getDoctorRatings:   (doctorId)       => api.get(`/consultations/ratings/${doctorId}`),
  getConsultMessages: (id)             => api.get(`/consultations/messages/${id}`),
  addVitals:          (id, data)       => api.patch(`/consultations/vitals/${id}`, data),
  getPatientLog:      (patientId)      => api.get(`/consultations/patient/${patientId}/log`),
};

export const otpAPI = {
  send:          (mobile, purpose)            => api.post('/otp/send', { mobile, purpose }),
  verify:        (mobile, purpose, otp)       => api.post('/otp/verify', { mobile, purpose, otp }),
  resend:        (mobile, purpose)            => api.post('/otp/resend', { mobile, purpose }),
  resetPassword: (mobile, otp, new_password)  => api.post('/otp/reset-password', { mobile, otp, new_password }),
};

export const adminAPI = {
  getDashboard:       ()           => api.get('/admin/dashboard'),
  getPendingDoctors:  (status)     => api.get('/admin/doctors/pending', { params: { status } }),
  reviewDoctor:       (id, data)   => api.patch(`/admin/doctors/${id}/review`, data),
  getWHOQueue:        ()           => api.get('/admin/who-queue'),
  reviewPrescription: (id, data)   => api.patch(`/admin/who-review/${id}`, data),
  getUsers:           (params)     => api.get('/admin/users', { params }),
};

export const notificationAPI = {
  getAll:         () => api.get('/notifications'),
  markRead:       (id) => api.patch(`/notifications/${id}/read`),
  markAllRead:    () => api.patch('/notifications/mark-all-read'),
};

export const opsAPI = {
  getDashboard:   ()         => api.get('/ops/dashboard'),
  // Coding
  createCoding:   (d)        => api.post('/ops/coding', d),
  getCodingCases: ()         => api.get('/ops/coding'),
  getCodingById:  (id)       => api.get(`/ops/coding/${id}`),
  reviewCoding:   (id, d)    => api.patch(`/ops/coding/${id}/review`, d),
  // Prior Auth
  createPA:       (d)        => api.post('/ops/prior-auth', d),
  getPACases:     ()         => api.get('/ops/prior-auth'),
  getPAById:      (id)       => api.get(`/ops/prior-auth/${id}`),
  reviewPA:       (id, d)    => api.patch(`/ops/prior-auth/${id}/review`, d),
  // Decision Support
  createDC:       (d)        => api.post('/ops/decision', d),
  reviewDC:       (id, d)    => api.patch(`/ops/decision/${id}/review`, d),
  // Audit
  getAuditLog:    (params)   => api.get('/ops/audit', { params }),
  getAuditEntry:  (id)       => api.get(`/ops/audit/${id}`),
  getCaseAudit:   (caseId)   => api.get(`/ops/audit/case/${caseId}`),
};

export default appointmentAPI;
