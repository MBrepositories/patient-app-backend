const authService = require('../services/auth.service');
const { success, error } = require('../utils/response');

const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    return success(res, result, 201);
  } catch (err) {
    console.error('Register error:', err);
    return error(res, err.message || 'Something went wrong.', err.statusCode || 500);
  }
};

const sendOtp = async (req, res) => {
  try {
    await authService.sendOtp(req.body);
    return res.status(200).json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const result = await authService.verifyOtp(req.body);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

module.exports = { login, register, sendOtp, verifyOtp };
