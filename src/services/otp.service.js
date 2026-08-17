const axios = require('axios');
const nodemailer = require('nodemailer');
const db = require('../config/db');

const RESEND_COOLDOWN_SECONDS = 60;

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOtp = async (channel, target) => {
  // Rate limiting — block if OTP was sent within last 60 seconds
  const [existing] = await db.query(
    'SELECT sent_at FROM app_otp_verifications WHERE channel = ? AND target = ?',
    [channel, target]
  );
  if (existing.length) {
    const sentAt = new Date(existing[0].sent_at);
    const secondsSinceSent = (Date.now() - sentAt.getTime()) / 1000;
    if (secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceSent);
      const err = new Error(`Please wait ${wait} seconds before requesting a new OTP.`);
      err.statusCode = 429;
      throw err;
    }
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + process.env.OTP_EXPIRY_MINUTES * 60 * 1000);

  // Remove old OTP and store new one
  await db.query(
    'DELETE FROM app_otp_verifications WHERE channel = ? AND target = ?',
    [channel, target]
  );
  await db.query(
    'INSERT INTO app_otp_verifications (channel, target, otp, attempts, expires_at, sent_at) VALUES (?, ?, ?, 0, ?, NOW())',
    [channel, target, otp, expiresAt]
  );

  if (channel === 'phone') {
    await sendSms(target, otp);
  } else if (channel === 'email') {
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
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.verify();
  console.log('SMTP connection verified');

  const info = await transporter.sendMail({
    from: `"Madhavbaug" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your OTP for Madhavbaug Application',
    text: `Your verification code for Madhavbaug Application is ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES} minutes.`,
  });
  console.log('Email sent:', info.messageId, '| Response:', info.response);
};

const verifyOtp = async (channel, target, otp) => {
  const [rows] = await db.query(
    'SELECT * FROM app_otp_verifications WHERE channel = ? AND target = ?',
    [channel, target]
  );
  const record = rows[0];

  if (!record) {
    const err = new Error('OTP not found. Please request a new one.'); err.statusCode = 400; throw err;
  }

  if (new Date() > new Date(record.expires_at)) {
    await db.query('DELETE FROM app_otp_verifications WHERE id = ?', [record.id]);
    const err = new Error('OTP has expired. Please request a new one.'); err.statusCode = 400; throw err;
  }

  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
  if (record.attempts >= maxAttempts) {
    const err = new Error('Maximum OTP attempts exceeded. Please request a new one.'); err.statusCode = 400; throw err;
  }

  if (record.otp !== otp) {
    await db.query(
      'UPDATE app_otp_verifications SET attempts = attempts + 1 WHERE id = ?',
      [record.id]
    );
    const remaining = maxAttempts - (record.attempts + 1);
    const err = new Error(`Invalid OTP. ${remaining} attempt(s) remaining.`); err.statusCode = 400; throw err;
  }

  // OTP correct — delete so it cannot be reused
  await db.query('DELETE FROM app_otp_verifications WHERE id = ?', [record.id]);
  return true;
};

module.exports = { sendOtp, verifyOtp };
