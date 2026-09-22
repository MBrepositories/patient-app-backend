const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getRewardsSummary } = require('../controllers/rewards.controller');

/**
 * @swagger
 * /rewards/summary:
 *   get:
 *     summary: Get patient reward points summary with activities and milestones
 *     tags: [Rewards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rewards summary fetched successfully
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
 *                     totalPoints:
 *                       type: integer
 *                       example: 2450
 *                     tierLabel:
 *                       type: string
 *                       enum: [Bronze, Silver, Gold, Platinum]
 *                       example: Gold
 *                     pointsThisWeek:
 *                       type: integer
 *                       example: 340
 *                     pointsRedeemed:
 *                       type: integer
 *                       example: 0
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                     milestones:
 *                       type: array
 *                       items:
 *                         type: object
 *                     proTip:
 *                       type: string
 */
router.get('/summary', authenticate, getRewardsSummary);

module.exports = router;
