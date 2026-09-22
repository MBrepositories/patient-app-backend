const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getStepsDetail,
  syncSteps,
  getWalkingDetail,
  syncWalking,
} = require('../controllers/steps.controller');

// ─── STEPS ROUTER ─────────────────────────────────────────────────────────────

const stepsRouter = express.Router();

/**
 * @swagger
 * /steps/detail:
 *   get:
 *     summary: Get today's step details with hourly breakdown and weekly history
 *     tags: [Steps & Walking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Step details fetched successfully
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
 *                     todaySteps:
 *                       type: integer
 *                       example: 6200
 *                     goalSteps:
 *                       type: integer
 *                       example: 10000
 *                     caloriesBurned:
 *                       type: number
 *                       example: 248.0
 *                     distanceKm:
 *                       type: number
 *                       example: 4.96
 *                     activeMinutes:
 *                       type: integer
 *                       example: 62
 *                     hourlyBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: integer
 *                             example: 9
 *                           steps:
 *                             type: integer
 *                             example: 1200
 *                     weeklyHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: "2026-08-13"
 *                           steps:
 *                             type: integer
 *                             example: 8500
 *                           goalMet:
 *                             type: boolean
 *                             example: false
 */
stepsRouter.get('/detail', authenticate, getStepsDetail);

/**
 * @swagger
 * /steps/sync:
 *   post:
 *     summary: Sync step count (triggered every 100-step boundary by the pedometer)
 *     tags: [Steps & Walking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [steps]
 *             properties:
 *               steps:
 *                 type: integer
 *                 description: Current running total from pedometer
 *                 example: 1300
 *     responses:
 *       204:
 *         description: Steps synced successfully
 */
stepsRouter.post('/sync', authenticate, syncSteps);

// ─── WALKING ROUTER ───────────────────────────────────────────────────────────

const walkingRouter = express.Router();

/**
 * @swagger
 * /walking/detail:
 *   get:
 *     summary: Get today's walking metrics
 *     tags: [Steps & Walking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Walking details fetched successfully
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
 *                     steps:
 *                       type: integer
 *                       example: 4200
 *                     targetSteps:
 *                       type: integer
 *                       example: 5000
 *                     distanceKm:
 *                       type: number
 *                       example: 3.36
 *                     walkingTimeMinutes:
 *                       type: integer
 *                       example: 40
 *                     paceMinPerKm:
 *                       type: number
 *                       example: 12.0
 *                     caloriesBurned:
 *                       type: number
 *                       example: 168.0
 *                     compliancePercent:
 *                       type: integer
 *                       example: 84
 */
walkingRouter.get('/detail', authenticate, getWalkingDetail);

/**
 * @swagger
 * /walking/sync:
 *   post:
 *     summary: Sync walking step count (same trigger as steps/sync, stored separately)
 *     tags: [Steps & Walking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [steps]
 *             properties:
 *               steps:
 *                 type: integer
 *                 description: Current running total from pedometer
 *                 example: 4200
 *     responses:
 *       204:
 *         description: Walking steps synced successfully
 */
walkingRouter.post('/sync', authenticate, syncWalking);

module.exports = { stepsRouter, walkingRouter };
