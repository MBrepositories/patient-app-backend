const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Authorization token required.', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token.', 401);
  }
};

const authenticateDoctor = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Authorization token required.', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor') {
      return error(res, 'Access denied. Doctor role required.', 403);
    }
    req.user = decoded;
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token.', 401);
  }
};

module.exports = { authenticate, authenticateDoctor };
