const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/profile.validator');
const { getProfile, updateProfile } = require('../controllers/profile.controller');

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: Get authenticated user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
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
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                     dateOfBirth:
 *                       type: string
 *                       example: "1992-12-04"
 *                     gender:
 *                       type: string
 *                       enum: [male, female, other]
 *                     healthGoal:
 *                       type: string
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                     isVerified:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, getProfile);

/**
 * @swagger
 * /profile:
 *   patch:
 *     summary: Update authenticated user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
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
 *               dateOfBirth:
 *                 type: string
 *                 example: "1992-12-04"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               healthGoal:
 *                 type: string
 *                 example: Improving cardiovascular health.
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
router.patch('/', authenticate, validate(updateProfileSchema), updateProfile);

module.exports = router;
