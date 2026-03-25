// middleware to verify user authentication and protect secured routes
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');

/**
 * authenticate — verifies JWT and attaches user to req
 * Works for: patient | doctor | admin
 */
exports.authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    const token = header.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') return next(new AppError('Session expired. Please log in again.', 401));
      return next(new AppError('Invalid token. Please log in again.', 401));
    }

    // Load user based on role from token
    let user = null;
    const { id, role } = decoded;

    if (role === 'patient') {
      const res2 = await query(
        'SELECT id, first_name, last_name, mobile, email, is_active, preferred_lang, profile_photo, health_score FROM users WHERE id=$1',
        [id]
      );
      user = res2.rows[0];
    } else if (role === 'doctor') {
      const res2 = await query(
        'SELECT id, first_name, last_name, mobile, email, is_active, specialization, verification_status, profile_photo FROM doctors WHERE id=$1',
        [id]
      );
      user = res2.rows[0];
    } else if (role === 'admin') {
      const res2 = await query('SELECT id, name, email, role FROM admins WHERE id=$1', [id]);
      user = res2.rows[0];
    }

    if (!user) return next(new AppError('Account not found. Please log in again.', 401));
    if (user.is_active === false) return next(new AppError('Account deactivated. Contact support.', 403));

    req.user = { ...user, role };
    next();
  } catch (err) {
    next(new AppError('Authentication failed.', 401));
  }
};

/**
 * authorize — role-based access control
 * Usage: authorize('admin') or authorize('doctor', 'admin')
 */
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Not authenticated', 401));
  if (!roles.includes(req.user.role)) {
    return next(new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403));
  }
  next();
};
