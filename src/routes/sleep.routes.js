const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { syncSleep, deleteAllSleep, getSleepNights } = require('../services/sleep.service');
const { success, error } = require('../utils/response');

/**
 * @swagger
 * /sleep/sync:
 *   post:
 *     summary: Save (sync) sleep data from wearable or phone
 *     tags: [Sleep]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               timezoneOffsetMinutes:
 *                 type: integer
 *                 example: 330
 *               nights:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       example: "2026-09-22"
 *                     sleepStart:
 *                       type: string
 *                       example: "2026-09-21T17:25:00.000Z"
 *                     wakeTime:
 *                       type: string
 *                       example: "2026-09-22T00:55:00.000Z"
 *                     durationMinutes:
 *                       type: integer
 *                       example: 412
 *                     timeInBedMinutes:
 *                       type: integer
 *                       example: 450
 *                     source:
 *                       type: string
 *                       example: wearable
 *                     sourceName:
 *                       type: string
 *                       example: Samsung Health
 *                     efficiencyPercent:
 *                       type: integer
 *                       example: 91
 *                     awakenings:
 *                       type: integer
 *                       example: 2
 *                     sleepLatencyMinutes:
 *                       type: integer
 *                       example: 14
 *                     stageMinutes:
 *                       type: object
 *                       properties:
 *                         awake:
 *                           type: integer
 *                           example: 30
 *                         light:
 *                           type: integer
 *                           example: 150
 *                         deep:
 *                           type: integer
 *                           example: 90
 *                         rem:
 *                           type: integer
 *                           example: 120
 *                         asleep:
 *                           type: integer
 *                           example: 360
 *                     sleepScore:
 *                       type: integer
 *                       example: 78
 *                     sleepQuality:
 *                       type: string
 *                       example: GOOD
 *               deletedDates:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["2026-09-18"]
 *     responses:
 *       200:
 *         description: Sleep data synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 */
router.post('/sync', authenticate, async (req, res) => {
  try {
    await syncSleep(req.user.id, req.body);
    return res.json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /sleep/sync:
 *   delete:
 *     summary: Delete all sleep data for the patient
 *     tags: [Sleep]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sleep data deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 */
router.delete('/sync', authenticate, async (req, res) => {
  try {
    await deleteAllSleep(req.user.id);
    return res.json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /sleep/nights:
 *   get:
 *     summary: Get sleep history for a date range
 *     tags: [Sleep]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-08-30"
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-09-28"
 *     responses:
 *       200:
 *         description: Sleep nights fetched successfully
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
 *                     nights:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: "2026-09-22"
 *                           sleepStart:
 *                             type: string
 *                             example: "2026-09-21T17:25:00.000Z"
 *                           wakeTime:
 *                             type: string
 *                             example: "2026-09-22T00:55:00.000Z"
 *                           durationMinutes:
 *                             type: integer
 *                             example: 412
 *                           timeInBedMinutes:
 *                             type: integer
 *                             example: 450
 *                           timezoneOffsetMinutes:
 *                             type: integer
 *                             example: 330
 *                           source:
 *                             type: string
 *                             example: wearable
 *                           sourceName:
 *                             type: string
 *                             example: Samsung Health
 *                           confidence:
 *                             type: number
 *                             example: null
 *                           efficiencyPercent:
 *                             type: integer
 *                             example: 91
 *                           awakenings:
 *                             type: integer
 *                             example: 2
 *                           sleepLatencyMinutes:
 *                             type: integer
 *                             example: 14
 *                           disturbances:
 *                             type: integer
 *                             example: null
 *                           stageMinutes:
 *                             type: object
 *                             properties:
 *                               awake:
 *                                 type: integer
 *                                 example: 30
 *                               light:
 *                                 type: integer
 *                                 example: 150
 *                               deep:
 *                                 type: integer
 *                                 example: 90
 *                               rem:
 *                                 type: integer
 *                                 example: 120
 *                               asleep:
 *                                 type: integer
 *                                 example: 360
 *                           lowMotionSignal:
 *                             type: boolean
 *                             example: false
 *                           trackingNotStopped:
 *                             type: boolean
 *                             example: false
 *                           sleepScore:
 *                             type: integer
 *                             example: 78
 *                           sleepQuality:
 *                             type: string
 *                             example: GOOD
 *       400:
 *         description: Missing query params
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: from and to query params are required
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 */
router.get('/nights', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return error(res, 'from and to query params are required', 400);
    const result = await getSleepNights(req.user.id, { from, to });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

module.exports = router;
