const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validate');
const { registerSchema, sendOtpSchema, verifyOtpSchema } = require('../validators/auth.validator');
const { authenticate } = require('../middleware/auth');
const { register, sendOtp, verifyOtp, logout, passwordResetRequest, passwordVerifyOtp, passwordReset, login } = require('../controllers/auth.controller');
const { socialLoginHandler } = require('../controllers/social.auth.controller');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new patient or doctor
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, phone, gender, password, branchId]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 example: patient
 *               firstName:
 *                 type: string
 *                 description: Required for patient
 *                 example: Rahul
 *               middleName:
 *                 type: string
 *                 example: Kumar
 *               lastName:
 *                 type: string
 *                 description: Required for patient
 *                 example: Sharma
 *               name:
 *                 type: string
 *                 description: Required for doctor (full name)
 *                 example: Dr. Arjun Mehta
 *               email:
 *                 type: string
 *                 description: Required for doctor, optional for patient
 *                 example: arjun@madhavbaug.com
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 example: Male
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: Passw0rd!
 *               branchId:
 *                 type: integer
 *                 description: Branch ID. Send 1 if no branch selection in app.
 *                 example: 1
 *     responses:
 *       201:
 *         description: Registered successfully
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
 *                           type: integer
 *                           example: 1
 *                         patientId:
 *                           type: string
 *                           example: MB260001
 *                         name:
 *                           type: string
 *                           example: Rahul Sharma
 *                         phone:
 *                           type: string
 *                           example: "9876543210"
 *                         email:
 *                           type: string
 *                           nullable: true
 *                         role:
 *                           type: string
 *                           example: patient
 *       409:
 *         description: Already registered
 */
router.post('/register', validate(registerSchema), register);

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Send OTP to phone or email (login initiation)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, channel, target]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 example: patient
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
 *                 message:
 *                   type: string
 *                   example: OTP sent successfully to your mobile number.
 *       404:
 *         description: No account found
 *       429:
 *         description: Please wait before requesting a new OTP
 */
router.post('/otp/send', validate(sendOtpSchema), sendOtp);

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Verify OTP and complete login
 *     description: |
 *       Verifies the OTP. If multiple patients share the same phone number,
 *       returns `requiresSelection: true` with a list of patients. Re-call this
 *       endpoint with the selected `patientDbId` to get the JWT.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, channel, target, otp]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 example: patient
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
 *               patientDbId:
 *                 type: integer
 *                 description: Required only when multiple patients are found
 *                 example: 42
 *     responses:
 *       200:
 *         description: OTP verified — returns JWT or patient selection list
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
 *                           type: integer
 *                           example: 1
 *                         patientId:
 *                           type: string
 *                           example: MB260001
 *                         name:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         email:
 *                           type: string
 *                           nullable: true
 *                         role:
 *                           type: string
 *                     requiresSelection:
 *                       type: boolean
 *                     patients:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           patientId:
 *                             type: string
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/otp/verify', validate(verifyOtpSchema), verifyOtp);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 */
router.post('/logout', authenticate, logout);

/**
 * @swagger
 * /auth/password/reset-request:
 *   post:
 *     summary: "Step 1 — Request OTP for password reset"
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email:
 *                 type: string
 *                 description: Mobile number or email address
 *                 example: "9876543210"
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 example: patient
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
 *                 message:
 *                   type: string
 *                   example: Reset link sent.
 *       404:
 *         description: No account found with this mobile number or email
 *       429:
 *         description: Please wait before requesting a new OTP
 */
router.post('/password/reset-request', passwordResetRequest);

/**
 * @swagger
 * /auth/password/verify-otp:
 *   post:
 *     summary: "Step 2 — Verify OTP and receive reset token"
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, otp, role]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Same mobile number or email used in step 1
 *                 example: "9876543210"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 description: Same role sent in step 1.
 *                 example: patient
 *     responses:
 *       200:
 *         description: OTP verified — reset token returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 resetToken:
 *                   type: string
 *                   example: prt_1176054_a3f9c21b4d88e0f1
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/password/verify-otp', passwordVerifyOtp);

/**
 * @swagger
 * /auth/password/reset:
 *   post:
 *     summary: "Step 3 — Set new password using reset token"
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resetToken, newPassword]
 *             properties:
 *               resetToken:
 *                 type: string
 *                 example: prt_1176054_a3f9c21b4d88e0f1
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: NewPassword123
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password updated.
 *       400:
 *         description: Reset token is invalid or expired
 */
router.post('/password/reset', passwordReset);

/**
 * @swagger
 * /auth/social/login:
 *   post:
 *     summary: Login or register via Google or Apple
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, idToken, role]
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, apple]
 *                 example: google
 *               idToken:
 *                 type: string
 *                 description: ID token received from Google/Apple SDK on the app
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6...
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 example: patient
 *     responses:
 *       200:
 *         description: Logged in successfully
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
 *                           type: integer
 *                           example: 4
 *                         patientId:
 *                           type: string
 *                           example: MB260001
 *                         name:
 *                           type: string
 *                           example: Rahul Sharma
 *                         phone:
 *                           type: string
 *                           nullable: true
 *                         email:
 *                           type: string
 *                           nullable: true
 *                         role:
 *                           type: string
 *                           example: patient
 *       401:
 *         description: Invalid or expired provider token
 *       404:
 *         description: Doctor account not found (doctor role only)
 */
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with phone/email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password, role]
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Mobile number or email address
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: "MyPassword@123"
 *               role:
 *                 type: string
 *                 enum: [patient, doctor]
 *                 example: patient
 *     responses:
 *       200:
 *         description: Logged in successfully
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
 *                           type: integer
 *                           example: 4
 *                         name:
 *                           type: string
 *                           example: Rahul Sharma
 *                         phone:
 *                           type: string
 *                           nullable: true
 *                         email:
 *                           type: string
 *                           nullable: true
 *                         role:
 *                           type: string
 *                           example: patient
 *       401:
 *         description: Incorrect password
 *       404:
 *         description: Account not found
 */
router.post('/login', login);

router.post('/social/login', socialLoginHandler);

module.exports = router;
