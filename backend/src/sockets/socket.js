const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');

let io;

// Track active connections: userId → socketId
const userSockets = new Map();
const doctorSockets = new Map();

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (process.env.FRONTEND_URL || 'http://localhost:5173').split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ─────────────────────────────────
  io.on('connection', (socket) => {
    const { userId, userRole } = socket;
    logger.info(`Socket connected: userId=${userId} role=${userRole} socketId=${socket.id}`);

    if (userRole === 'doctor') {
      doctorSockets.set(userId, socket.id);
      socket.join(`doctor:${userId}`);
    } else {
      userSockets.set(userId, socket.id);
      socket.join(`user:${userId}`);
    }

    // ── Teleconsult events ─────────────────────────────
    socket.on('join_consultation', async ({ appointmentId }) => {
      try {
        const result = await query(
          `SELECT a.*, u.first_name || ' ' || u.last_name AS patient_name,
                  d.first_name || ' ' || d.last_name AS doctor_name
           FROM appointments a
           JOIN users u ON a.patient_id = u.id
           JOIN doctors d ON a.doctor_id = d.id
           WHERE a.id=$1`, [appointmentId]
        );
        const appt = result.rows[0];
        if (!appt) return socket.emit('error', { message: 'Appointment not found' });

        // Authorise
        const isPatient = appt.patient_id === userId;
        const isDoctor  = appt.doctor_id === userId;
        if (!isPatient && !isDoctor) return socket.emit('error', { message: 'Unauthorised' });

        socket.join(`consultation:${appointmentId}`);

        // Update status to in_progress if both parties join
        await query(
          `UPDATE appointments SET status='in_progress', started_at=COALESCE(started_at,NOW())
           WHERE id=$1 AND status IN ('scheduled','waiting')`,
          [appointmentId]
        );

        // Notify room
        io.to(`consultation:${appointmentId}`).emit('participant_joined', {
          userId, role: userRole,
          name: userRole === 'doctor' ? appt.doctor_name : appt.patient_name,
        });

        logger.info(`User ${userId} (${userRole}) joined consultation:${appointmentId}`);
      } catch (err) {
        logger.error('join_consultation error:', err.message);
        socket.emit('error', { message: 'Failed to join consultation' });
      }
    });

    socket.on('leave_consultation', ({ appointmentId }) => {
      socket.leave(`consultation:${appointmentId}`);
      io.to(`consultation:${appointmentId}`).emit('participant_left', { userId, role: userRole });
    });

    // Real-time chat within consultation
    socket.on('consultation_message', async ({ appointmentId, message }) => {
      try {
        const { v4: uuidv4 } = require('uuid');
        const msgId = uuidv4();
        await query(
          `INSERT INTO consultation_messages (id, appointment_id, sender_id, sender_role, message)
           VALUES ($1,$2,$3,$4,$5)`,
          [msgId, appointmentId, userId, userRole, message]
        );
        io.to(`consultation:${appointmentId}`).emit('consultation_message', {
          id: msgId, sender_id: userId, sender_role: userRole,
          message, timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error('consultation_message error:', err.message);
      }
    });

    // WebRTC signalling relay
    socket.on('webrtc_offer',     (data) => socket.to(`consultation:${data.appointmentId}`).emit('webrtc_offer', data));
    socket.on('webrtc_answer',    (data) => socket.to(`consultation:${data.appointmentId}`).emit('webrtc_answer', data));
    socket.on('webrtc_ice',       (data) => socket.to(`consultation:${data.appointmentId}`).emit('webrtc_ice', data));

    // Doctor queue management
    socket.on('doctor_available', async () => {
      if (userRole !== 'doctor') return;
      await query(`UPDATE doctors SET is_available=TRUE WHERE id=$1`, [userId]);
      io.emit('queue_update', { doctor_id: userId, available: true });
    });

    socket.on('doctor_unavailable', async () => {
      if (userRole !== 'doctor') return;
      await query(`UPDATE doctors SET is_available=FALSE WHERE id=$1`, [userId]);
      io.emit('queue_update', { doctor_id: userId, available: false });
    });

    // End consultation
    socket.on('end_consultation', async ({ appointmentId, notes }) => {
      try {
        await query(
          `UPDATE appointments SET status='completed', ended_at=NOW(), doctor_notes=$2
           WHERE id=$1`, [appointmentId, notes]
        );
        io.to(`consultation:${appointmentId}`).emit('consultation_ended', { appointmentId, ended_by: userRole });
        logger.info(`Consultation ended: ${appointmentId} by ${userRole} ${userId}`);
      } catch (err) {
        logger.error('end_consultation error:', err.message);
      }
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      userSockets.delete(userId);
      doctorSockets.delete(userId);
      logger.info(`Socket disconnected: userId=${userId} reason=${reason}`);
    });
  });

  logger.info('Socket.IO ready');
  return io;
}

// ── Helpers for controllers ────────────────────────────────
function getIO() { return io; }

function notifyUser(userId, event, data) {
  const socketId = userSockets.get(userId);
  if (socketId && io) io.to(`user:${userId}`).emit(event, data);
}

function notifyDoctor(doctorId, event, data) {
  if (io) io.to(`doctor:${doctorId}`).emit(event, data);
}

function broadcastQueueUpdate(data) {
  if (io) io.emit('queue_update', data);
}

module.exports = { initSocket, getIO, notifyUser, notifyDoctor, broadcastQueueUpdate };
