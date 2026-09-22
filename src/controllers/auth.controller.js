const authService = require('../services/auth.service');
const { success, error } = require('../utils/response');

const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    return success(res, result, 201);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const sendOtp = async (req, res) => {
  try {
    await authService.sendOtp(req.body);
    const { channel } = req.body;
    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to your ${channel === 'phone' ? 'mobile number' : 'email address'}.`,
    });
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

const logout = (req, res) => {
  return res.status(200).json({ success: true });
};

const passwordResetRequest = async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return error(res, 'Mobile number or email is required.', 400);
    if (!role || !['patient', 'doctor'].includes(role)) return error(res, 'role is required. Use patient or doctor.', 400);
    await authService.passwordResetRequest(email.trim(), role);
    return res.status(200).json({ success: true, message: 'Reset link sent.' });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const passwordVerifyOtp = async (req, res) => {
  try {
    const { identifier, otp, role } = req.body;
    if (!identifier || !otp) return error(res, 'identifier and otp are required.', 400);
    if (!role || !['patient', 'doctor'].includes(role)) return error(res, 'role is required. Use patient or doctor.', 400);
    const result = await authService.passwordVerifyOtp(identifier.trim(), otp.trim(), role);
    return res.status(200).json({ success: true, resetToken: result.resetToken });
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

const passwordReset = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return error(res, 'resetToken and newPassword are required.', 400);
    await authService.passwordReset(resetToken, newPassword);
    return res.status(200).json({ success: true, message: 'Password updated.' });
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password, role } = req.body;
    if (!identifier || !password || !role) return error(res, 'identifier, password and role are required.', 400);
    const result = await authService.loginWithPassword(identifier.trim(), password, role);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { register, sendOtp, verifyOtp, logout, passwordResetRequest, passwordVerifyOtp, passwordReset, login };
