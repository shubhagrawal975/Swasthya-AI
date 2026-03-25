// configuring express application with middleware and route handlers
// ensuring consistent structure across middleware, routes, and controllers
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');

const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ── Security ──────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(','),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Language','X-Request-ID'],
}));

// setting up middleware for parsing requests and handling cross-origin access
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: m => logger.http(m.trim()) } }));
}

// ── Static uploads ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rate limiting ─────────────────────────────────────────
app.use('/api', generalLimiter);

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok', service: 'SwasthyaAI API', version: '2.0.0',
  timestamp: new Date().toISOString(),
  sms_provider: process.env.SMS_PROVIDER || 'console',
  video_provider: process.env.VIDEO_PROVIDER || 'jitsi',
}));
app.get('/api/health', (req, res) => res.json({
  status: 'ok', service: 'SwasthyaAI API', version: '2.0.0',
  timestamp: new Date().toISOString(),
  sms_provider: process.env.SMS_PROVIDER || 'console',
  video_provider: process.env.VIDEO_PROVIDER || 'jitsi',
}));

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/otp',           require('./routes/otp.routes'));
app.use('/api/users',         require('./routes/user.routes'));
app.use('/api/doctors',       require('./routes/doctor.routes'));
app.use('/api/prescriptions', require('./routes/prescription.routes'));
app.use('/api/who-review',    require('./routes/whoReview.routes'));
app.use('/api/chat',          require('./routes/chat.routes'));
app.use('/api/ai',            require('./routes/ai.routes'));
app.use('/api/camps',         require('./routes/camp.routes'));
app.use('/api/associations',  require('./routes/association.routes'));
app.use('/api/health-plans',  require('./routes/healthPlan.routes'));
app.use('/api/appointments',  require('./routes/appointment.routes'));
app.use('/api/consultations', require('./routes/consultation.routes'));
app.use('/api/admin',         require('./routes/admin.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/video',         require('./routes/video.routes'));
app.use('/api/ops',           require('./routes/ops/ops.routes'));

app.use('*', (req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));
app.use(errorHandler);

module.exports = app;
