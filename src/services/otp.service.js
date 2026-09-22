const axios = require('axios');
const nodemailer = require('nodemailer');
const db = require('../config/db');

const RESEND_COOLDOWN_SECONDS = 60;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOtp = async (userType, userId, channel, target) => {
  // Rate limiting — block if OTP sent within last 60 seconds
  const [existing] = await db.query(
    'SELECT TIMESTAMPDIFF(SECOND, sent_at, NOW()) AS seconds_since FROM app_otps WHERE user_type = ? AND channel = ? AND target = ? ORDER BY sent_at DESC LIMIT 1',
    [userType, channel, target]
  );
  if (existing.length) {
    const secondsSince = existing[0].seconds_since;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
      const err = new Error(`Please wait ${wait} seconds before requesting a new OTP.`);
      err.statusCode = 429;
      throw err;
    }
  }

  const otp = generateOtp();
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;

  await db.query(
    `INSERT INTO app_otps (user_type, user_id, channel, target, otp, attempts, expires_at, sent_at)
     VALUES (?, ?, ?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL ${expiryMinutes} MINUTE), NOW())`,
    [userType, userId, channel, target, otp]
  );

  if (channel === 'phone') {
    await sendSms(target, otp);
  } else {
    await sendEmail(target, otp);
  }
};

const sendSms = async (phone, otp) => {
  const message = `Your verification code for Madhavbaug Application is ${otp}`;
  const params = new URLSearchParams({
    username: process.env.PINNACLE_USERNAME,
    pass: process.env.PINNACLE_PASSWORD,
    senderid: process.env.PINNACLE_SENDER_ID,
    dest_mobileno: phone,
    dlttempid: process.env.PINNACLE_TEMPLATE_ID,
    message,
    response: 'Y',
  });
  const response = await axios.post(process.env.PINNACLE_API_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  console.log('Pinnacle SMS response:', response.data);
};

const sendEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.verify();
  const info = await transporter.sendMail({
    from: `"Madhavbaug" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your OTP for Madhavbaug Application',
    text: `Your verification code for Madhavbaug Application is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`,
  });
  console.log('Email sent:', info.messageId);
};

const verifyOtp = async (userType, channel, target, otp) => {
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;

  const [rows] = await db.query(
    `SELECT *, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_remaining
     FROM app_otps
     WHERE user_type = ? AND channel = ? AND target = ? AND verified_at IS NULL
     ORDER BY sent_at DESC LIMIT 1`,
    [userType, channel, target]
  );
  const record = rows[0];

  if (!record) {
    const err = new Error('OTP not found. Please request a new one.'); err.statusCode = 400; throw err;
  }

  if (record.seconds_remaining <= 0) {
    const err = new Error('OTP has expired. Please request a new one.'); err.statusCode = 400; throw err;
  }

  if (record.attempts >= maxAttempts) {
    const err = new Error('Maximum OTP attempts exceeded. Please request a new one.'); err.statusCode = 400; throw err;
  }

  if (record.otp !== otp) {
    await db.query('UPDATE app_otps SET attempts = attempts + 1 WHERE id = ?', [record.id]);
    const remaining = maxAttempts - (record.attempts + 1);
    const err = new Error(`Invalid OTP. ${remaining} attempt(s) remaining.`); err.statusCode = 400; throw err;
  }

  await db.query('UPDATE app_otps SET verified_at = NOW() WHERE id = ?', [record.id]);
  return true;
};

// Check a recently verified OTP exists (used for multi-patient second call)
const checkRecentlyVerified = async (userType, channel, target) => {
  const [rows] = await db.query(
    `SELECT id FROM app_otps
     WHERE user_type = ? AND channel = ? AND target = ?
       AND verified_at IS NOT NULL
       AND verified_at > NOW() - INTERVAL 10 MINUTE
     ORDER BY verified_at DESC LIMIT 1`,
    [userType, channel, target]
  );
  if (!rows.length) {
    const err = new Error('OTP session expired. Please request a new OTP.'); err.statusCode = 400; throw err;
  }
};

module.exports = { sendOtp, verifyOtp, checkRecentlyVerified };
