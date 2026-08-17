const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDashboardSummary } = require('../controllers/dashboard.controller');

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Get dashboard summary
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data fetched successfully
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
 *                     streak:
 *                       type: object
 *                       properties:
 *                         days:
 *                           type: integer
 *                           example: 0
 *                     goals:
 *                       type: object
 *                       properties:
 *                         completed:
 *                           type: integer
 *                         target:
 *                           type: integer
 *                         completionMessage:
 *                           type: string
 *                     vitals:
 *                       type: object
 *                       properties:
 *                         logged:
 *                           type: integer
 *                         target:
 *                           type: integer
 *                     steps:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                     points:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                     compliance:
 *                       type: object
 *                       properties:
 *                         dietPercent:
 *                           type: number
 *                         exercisePercent:
 *                           type: number
 *                         medicinePercent:
 *                           type: number
 *                         sleepAvgHours:
 *                           type: number
 *                         stepsAvgPerDay:
 *                           type: number
 *                     reversalJourney:
 *                       type: object
 *                       properties:
 *                         stage:
 *                           type: string
 *                           enum: [started, improving, stable, reversed]
 *                           nullable: true
 *                         hba1cLevel:
 *                           type: number
 *                           nullable: true
 *                         weightLossKg:
 *                           type: number
 *                           nullable: true
 *                     appointments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           date:
 *                             type: string
 *                             example: "Aug 12, 2026"
 *                           time:
 *                             type: string
 *                             example: "10:00 AM"
 *                           type:
 *                             type: string
 *                           status:
 *                             type: string
 *                           location:
 *                             type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/summary', authenticate, getDashboardSummary);

module.exports = router;
