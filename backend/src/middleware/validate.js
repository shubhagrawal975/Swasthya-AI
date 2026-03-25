const { validationResult } = require('express-validator');

module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map(e => ({
    field: e.path || e.param,
    message: e.msg,
    value: e.value,
  }));

  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: formatted,
  });
};
