require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initSocket } = require('./sockets/socket');
const logger = require('./utils/logger');
const cron = require('node-cron');
const { cleanExpiredOTPs, cleanExpiredSlots } = require('./services/cleanup.service');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    logger.info('✅ PostgreSQL connected');

    const server = http.createServer(app);
    initSocket(server);
    logger.info('✅ Socket.IO initialised');

    cron.schedule('*/5 * * * *', () => {
      cleanExpiredOTPs().catch(e => logger.warn('OTP cleanup error:', e.message));
    });
    cron.schedule('0 * * * *', () => {
      cleanExpiredSlots().catch(e => logger.warn('Slot cleanup error:', e.message));
    });

    server.listen(PORT, () => {
      logger.info(`🚀 SwasthyaAI API  →  http://localhost:${PORT}`);
      logger.info(`📋 Environment     →  ${process.env.NODE_ENV}`);
      logger.info(`📡 SMS Provider    →  ${process.env.SMS_PROVIDER || 'console'}`);
      logger.info(`🎥 Video Provider  →  ${process.env.VIDEO_PROVIDER || 'jitsi'}`);
    });

    process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
    process.on('SIGINT',  () => { server.close(() => process.exit(0)); });

  } catch (err) {
    logger.error('❌ Server start failed:', err);
    process.exit(1);
  }
}

startServer();
