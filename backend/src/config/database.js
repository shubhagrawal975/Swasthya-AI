// handles database connection setup and ensures connectivity with the application

const { Pool } = require('pg');
const logger = require('../utils/logger');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
const poolConfig = connectionString ? {
  connectionString,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
} : {
  host:              process.env.DB_HOST       || 'localhost',
  port:              parseInt(process.env.DB_PORT || '5432'),
  database:          process.env.DB_NAME       || 'swasthya_ai',
  user:              process.env.DB_USER       || 'postgres',
  password:          process.env.DB_PASSWORD,
  max:               20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl:               process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => logger.error('PostgreSQL pool error:', err));

// Simple query wrapper
const query = (text, params) => pool.query(text, params);

// Transaction helper
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
// initializing database connection using environment configuration
// Connect + test
function getDbDescription() {
  if (process.env.DATABASE_URL) return `DATABASE_URL=${process.env.DATABASE_URL}`;
  return `DB_HOST=${process.env.DB_HOST || 'localhost'} DB_PORT=${process.env.DB_PORT || '5432'} DB_NAME=${process.env.DB_NAME || 'swasthya_ai'} DB_USER=${process.env.DB_USER || 'postgres'} DB_PASSWORD=${process.env.DB_PASSWORD ? '*****' : '(missing)'}`;
}

async function connectDB() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT version()');
    client.release();
    logger.info(`PostgreSQL connected: ${res.rows[0].version.split(' ').slice(0,2).join(' ')}`);
    return pool;
  } catch (err) {
    logger.error('PostgreSQL connection failed:', err.message);
    logger.error('Current DB config:', getDbDescription());
    if (err.message.includes('password authentication failed') || err.message.includes('authentication failed')) {
      logger.error('❌ DB auth failed. Check PostgreSQL username/password and ensure the user has access to the database.');
      logger.error('   If using local Postgres, set DB_USER/DB_PASSWORD in backend/.env or set DATABASE_URL.');
    }
    if (err.message.includes('database "') && err.message.includes('does not exist')) {
      logger.error('❌ Database does not exist. Run npm run db:migrate first after creating the DB.');
    }
    throw err;
  }
}

module.exports = { pool, query, withTransaction, connectDB };
