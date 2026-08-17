const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const otpService = require('./otp.service');
const patientService = require('./patient.service');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

const formatUser = (user) => ({
  id: String(user.id),
  email: user.email,
  name: user.name,
  role: user.role,
});

const login = async ({ target, password, channel }) => {
  const field = channel === 'email' ? 'email' : 'phone';
  const [rows] = await db.query(
    `SELECT * FROM app_users WHERE ${field} = ?`,
    [target.toLowerCase()]
  );
  const user = rows[0];
  if (!user) {
    const err = new Error('Invalid credentials.'); err.statusCode = 401; throw err;
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const err = new Error('Invalid credentials.'); err.statusCode = 401; throw err;
  }
  return { token: generateToken(user), user: formatUser(user) };
};

const register = async ({ name, email, phone, password, role }) => {
  const [existing] = await db.query(
    'SELECT id, email, phone FROM app_users WHERE email = ? OR phone = ?',
    [email.toLowerCase(), phone]
  );
  if (existing.length) {
    const taken = existing[0];
    if (taken.email === email.toLowerCase()) {
      const err = new Error('Email already in use.'); err.statusCode = 409; throw err;
    }
    if (taken.phone === phone) {
      const err = new Error('Phone number already in use.'); err.statusCode = 409; throw err;
    }
  }
  const password_hash = await bcrypt.hash(password, 12);
  const [result] = await db.query(
    'INSERT INTO app_users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [name, email.toLowerCase(), phone, password_hash, role]
  );
  const user = { id: result.insertId, email: email.toLowerCase(), name, role };
  return { token: generateToken(user), user: formatUser(user) };
};

const sendOtp = async ({ channel, target }) => {
  await otpService.sendOtp(channel, target);
};

const verifyOtp = async ({ channel, target, otp }) => {
  await otpService.verifyOtp(channel, target, otp);

  // Find the app_user by phone/email and link to hospital patient
  const field = channel === 'phone' ? 'phone' : 'email';
  const [rows] = await db.query(
    `SELECT * FROM app_users WHERE ${field} = ?`,
    [target]
  );
  const user = rows[0];
  if (!user) {
    const err = new Error('User not found.'); err.statusCode = 404; throw err;
  }

  // Link to hospital patient and set verification status
  const { verificationStatus } = await patientService.linkHospitalPatient(user.id, user.phone);

  return {
    token: generateToken(user),
    user: { ...formatUser(user), verificationStatus },
  };
};

module.exports = { login, register, sendOtp, verifyOtp };
