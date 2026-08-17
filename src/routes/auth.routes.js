const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate');
const {
  loginSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
} = require('../validators/auth.validator');
const {
  login,
  register,
  sendOtp,
  verifyOtp,
} = require('../controllers/auth.controller');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, password, role]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Rahul Sharma
 *               email:
 *                 type: string
 *                 example: rahul@example.com
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: Passw0rd!
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 example: patient
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *       409:
 *         description: Email or phone already in use
 */
router.post('/register', validate(registerSchema), register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email or phone
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [target, password, channel]
 *             properties:
 *               target:
 *                 type: string
 *                 example: rahul@example.com
 *               password:
 *                 type: string
 *                 example: Passw0rd!
 *               channel:
 *                 type: string
 *                 enum: [email, mobile]
 *                 example: email
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), login);

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Send OTP to phone or email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [channel, target]
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [phone, email]
 *                 example: phone
 *               target:
 *                 type: string
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       429:
 *         description: Please wait before requesting a new OTP
 */
router.post('/otp/send', validate(sendOtpSchema), sendOtp);

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Verify OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [channel, target, otp]
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [phone, email]
 *                 example: phone
 *               target:
 *                 type: string
 *                 example: "9876543210"
 *               otp:
 *                 type: string
 *                 example: "482913"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *                         verificationStatus:
 *                           type: string
 *                           enum: [enrolled_patient, non_enrolled_patient, lead, unverified]
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/otp/verify', validate(verifyOtpSchema), verifyOtp);

module.exports = router;
