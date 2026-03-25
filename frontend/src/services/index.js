import api from './api';

export const authService = {
  registerUser:    (data)  => api.post('/auth/register/user', data),
  loginUser:       (data)  => api.post('/auth/login/user', data),
  loginUserWithOTP:(data)  => api.post('/auth/login/user/otp', data),
  registerDoctor:      (data)  => api.post('/auth/register/doctor', data, { headers:{ 'Content-Type':'multipart/form-data' } }),
  loginDoctor:         (data)  => api.post('/auth/login/doctor', data),
  loginDoctorWithOTP:  (data)  => api.post('/auth/login/doctor/otp', data),
  loginAdmin:          (data)  => api.post('/auth/login/admin', data),
  verifyLoginOTP:      (data)  => api.post('/auth/verify-otp', data),
  logout:          ()      => api.post('/auth/logout'),
  refreshToken:    (data)  => api.post('/auth/refresh-token', data),
};

export const otpService = {
  send:            (mobile, purpose)              => api.post('/otp/send', { mobile, purpose }),
  verify:          (mobile, purpose, otp)         => api.post('/otp/verify', { mobile, purpose, otp }),
  resend:          (mobile, purpose)              => api.post('/otp/resend', { mobile, purpose }),
  resetPassword:   (mobile, otp, new_password)    => api.post('/otp/reset-password', { mobile, otp, new_password }),
};

export const userAPI = {
  getProfile:        ()    => api.get('/users/profile'),
  updateProfile:     (d)   => api.patch('/users/profile', d),
  getNotifications:  ()    => api.get('/users/notifications'),
  markNotifRead:     (id)  => api.patch(`/users/notifications/${id}/read`),
  getDoctorUpdates:  ()    => api.get('/users/doctor-updates'),
};

export const doctorAPI = {
  getProfile:        ()    => api.get('/doctors/profile'),
  getVerification:   ()    => api.get('/doctors/verification'),
  updateProfile:     (d)   => api.patch('/doctors/profile', d),
  getDashboard:      ()    => api.get('/doctors/dashboard'),
  getPatients:       ()    => api.get('/doctors/patients'),
  listDoctors:       (p)   => api.get('/doctors/list', { params: p }),
};

export const prescriptionService = {
  create:            (d)   => api.post('/prescriptions', d),
  getDoctorRx:       (p)   => api.get('/prescriptions/doctor', { params: p }),
  getPatientRx:      ()    => api.get('/prescriptions/patient'),
  getWHOQueue:       ()    => api.get('/prescriptions/who-queue'),
  reviewRx:          (id,d)=> api.patch(`/prescriptions/who-review/${id}`, d),
};

export const chatService = {
  createSession:     (d)   => api.post('/chat/sessions', d),
  getSessions:       ()    => api.get('/chat/sessions'),
  getMessages:       (sid) => api.get(`/chat/sessions/${sid}/messages`),
  sendMessage:       (sid,d)=> api.post(`/chat/sessions/${sid}/messages`, d),
};

export const aiService = {
  sendMessage:       (d)   => api.post('/ai/chat', d),
  getChatHistory:    (sid) => api.get(`/ai/chat/${sid}`),
  generateAd:        (d)   => api.post('/ai/generate-ad', d),
  publishAd:         (id)  => api.patch(`/ai/ads/${id}/publish`),
};

export const campService = {
  create:            (d)   => api.post('/camps', d, { headers:{ 'Content-Type':'multipart/form-data' } }),
  getAll:            (p)   => api.get('/camps', { params: p }),
  getMyCamps:        ()    => api.get('/camps/my'),
  register:          (id)  => api.post(`/camps/${id}/register`),
};

export const associationService = {
  create:            (d)   => api.post('/associations', d),
  getAll:            ()    => api.get('/associations'),
  join:              (id)  => api.post(`/associations/${id}/join`),
};

export const healthPlanService = {
  getMyPlans:        ()    => api.get('/health-plans'),
  createPlan:        (d)   => api.post('/health-plans', d),
  updateTask:        (id,d)=> api.patch(`/health-plans/${id}/tasks`, d),
};

export const adminService = {
  getDashboard:      ()    => api.get('/admin/dashboard'),
  getPendingDoctors: (s)   => api.get('/admin/doctors/pending', { params:{ status:s } }),
  reviewDoctor:      (id,d)=> api.patch(`/admin/doctors/${id}/review`, d),
  getWHOQueue:       ()    => api.get('/admin/who-queue'),
  reviewPrescription:(id,d)=> api.patch(`/admin/who-review/${id}`, d),
  getUsers:          (p)   => api.get('/admin/users', { params: p }),
};

export default api;
