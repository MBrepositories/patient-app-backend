const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { get7DayAdherence } = require('../controllers/adherence.controller');

/**
 * @swagger
 * /adherence/7-day:
 *   get:
 *     summary: Get 7-day compliance rollup for diet, exercise and medicine
 *     tags: [History]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 7-day adherence summary fetched successfully
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
 *                     overallPercent:
 *                       type: integer
 *                       example: 68
 *                     progressLabel:
 *                       type: string
 *                       example: On Track
 *                     summaryMessage:
 *                       type: string
 *                       example: "You're on track. A little more effort will make a big difference."
 *                     healthInsight:
 *                       type: string
 *                       example: Logging all your meals today will improve your diet compliance score.
 *                     syncTitle:
 *                       type: string
 *                       example: PowerMAP Synchronization
 *                     syncDescription:
 *                       type: string
 *                     lastSyncedLabel:
 *                       type: string
 *                       example: "Last synced: just now"
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             enum: [diet, exercise, medicine]
 *                           label:
 *                             type: string
 *                             example: Diet Compliance
 *                           detailLabel:
 *                             type: string
 *                             example: 14/21 meals logged
 *                           percent:
 *                             type: integer
 *                             example: 67
 */
router.get('/7-day', authenticate, get7DayAdherence);

module.exports = router;
