const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getVitalsSummary, logVitals, getVitalsHistory, logWater, getWater } = require('../controllers/vitals.controller');

/**
 * @swagger
 * /vitals/summary:
 *   get:
 *     summary: Get current/last-recorded reading for each tracked vital
 *     tags: [Vitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vitals summary fetched successfully
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
 *                     lastRecordedAt:
 *                       type: string
 *                       example: "Oct 24, 2023 • 09:45 AM"
 *                     readings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: weight
 *                           type:
 *                             type: string
 *                             enum: [weight, hba1c, ldl, waist]
 *                           value:
 *                             type: number
 *                             example: 70
 *                           unit:
 *                             type: string
 *                             example: kg
 *                           badgeText:
 *                             type: string
 *                             example: "+0.5 kg from last"
 *                           status:
 *                             type: string
 *                             enum: [good, warning, danger]
 *                           helperText:
 *                             type: string
 *                             example: "Normal 60 - 90 kg"
 *                           progressPercent:
 *                             type: number
 *                             example: 94
 */
router.get('/summary', authenticate, getVitalsSummary);

/**
 * @swagger
 * /vitals/log:
 *   post:
 *     summary: Log one or more vitals (only send the ones patient edited)
 *     tags: [Vitals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [readings]
 *             properties:
 *               readings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [type, value]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [weight, hba1c, ldl, waist]
 *                       example: weight
 *                     value:
 *                       type: number
 *                       example: 71.2
 *     responses:
 *       200:
 *         description: Vitals logged successfully
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
 *                     recordedAt:
 *                       type: string
 *                       example: "Aug 14, 2026 • 11:02 AM"
 */
router.post('/log', authenticate, logVitals);

/**
 * @swagger
 * /vitals/history:
 *   get:
 *     summary: Get blood pressure trend chart, stats and recent readings
 *     tags: [Vitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vitals history fetched successfully
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
 *                     bloodPressureTrendByRange:
 *                       type: object
 *                       properties:
 *                         7D:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               dateLabel:
 *                                 type: string
 *                                 example: Mon
 *                               systolic:
 *                                 type: number
 *                                 example: 132
 *                               diastolic:
 *                                 type: number
 *                                 example: 86
 *                               showLabel:
 *                                 type: boolean
 *                                 example: true
 *                     stats:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recentReadings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: reading-bp-0
 *                           iconName:
 *                             type: string
 *                             example: water-drop
 *                           title:
 *                             type: string
 *                             example: "132/86 mmHg"
 *                           timeLabel:
 *                             type: string
 *                             example: "Today, 09:45 AM"
 *                           statusLabel:
 *                             type: string
 *                             example: Normal
 *                           statusTone:
 *                             type: string
 *                             enum: [good, high, low]
 *                     appVitalsTrendByType:
 *                       type: object
 *                       description: App-logged vitals history grouped by type
 *                       properties:
 *                         weight:
 *                           type: object
 *                           properties:
 *                             label:
 *                               type: string
 *                               example: Weight
 *                             unit:
 *                               type: string
 *                               example: kg
 *                             trendByRange:
 *                               type: object
 *                               properties:
 *                                 7D:
 *                                   type: array
 *                                   items:
 *                                     type: object
 *                                     properties:
 *                                       dateLabel:
 *                                         type: string
 *                                         example: Mon
 *                                       value:
 *                                         type: number
 *                                         example: 71.2
 *                                       showLabel:
 *                                         type: boolean
 *                             recentReadings:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     example: reading-weight-0
 *                                   title:
 *                                     type: string
 *                                     example: "71.2 kg"
 *                                   timeLabel:
 *                                     type: string
 *                                     example: "Today, 10:00 AM"
 *                                   statusLabel:
 *                                     type: string
 *                                     example: Normal
 *                                   statusTone:
 *                                     type: string
 *                                     enum: [good, warning, danger]
 */
router.get('/history', authenticate, getVitalsHistory);

/**
 * @swagger
 * /vitals/water:
 *   post:
 *     summary: Log water intake for today
 *     tags: [Vitals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [glasses]
 *             properties:
 *               glasses:
 *                 type: integer
 *                 example: 3
 *     responses:
 *       200:
 *         description: Water intake logged successfully
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
 *                     totalGlassesToday:
 *                       type: integer
 *                       example: 5
 */
router.post('/water', authenticate, logWater);

/**
 * @swagger
 * /vitals/water:
 *   get:
 *     summary: Get today's total water intake
 *     tags: [Vitals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Water intake fetched successfully
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
 *                     totalGlassesToday:
 *                       type: integer
 *                       example: 5
 */
router.get('/water', authenticate, getWater);

module.exports = router;
