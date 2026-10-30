const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getCarePlans,
  getTodayProgram,
  completeCameraSession,
  getCompliance,
  getWellnessHistory,
} = require('../controllers/exercise.controller');

/**
 * @swagger
 * /exercise/care-plans:
 *   get:
 *     summary: Get all exercise care plans
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Care plans fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       planId:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: Diabetes Care Plan
 */
router.get('/care-plans', authenticate, getCarePlans);

/**
 * @swagger
 * /exercise/program/today:
 *   get:
 *     summary: Get full 90-day exercise program for the patient
 *     description: |
 *       Returns all 90 days of the patient's enrolled care plan with protocol items per day.
 *       Manoswasthya meditation is always appended as a second daily item alongside the primary plan.
 *       Pass `planId` to preview a plan without enrollment.
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: planId
 *         schema:
 *           type: integer
 *         required: false
 *         description: Override enrolled plan (1–6)
 *     responses:
 *       200:
 *         description: Program fetched successfully
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
 *                     totalDays:
 *                       type: integer
 *                       example: 90
 *                     currentDayNumber:
 *                       type: integer
 *                       example: 5
 *                     tracks:
 *                       type: object
 *                       properties:
 *                         exercise:
 *                           type: object
 *                           properties:
 *                             assigned:
 *                               type: boolean
 *                               example: true
 *                             planName:
 *                               type: string
 *                               example: Diabetes Exercise Plan
 *                             currentDayNumber:
 *                               type: integer
 *                               example: 5
 *                             totalDays:
 *                               type: integer
 *                               example: 90
 *                             startDate:
 *                               type: string
 *                               example: "2026-09-26"
 *                         meditation:
 *                           type: object
 *                           properties:
 *                             assigned:
 *                               type: boolean
 *                               example: false
 *                             planName:
 *                               type: string
 *                               nullable: true
 *                               example: null
 *                             currentDayNumber:
 *                               type: integer
 *                               example: 1
 *                             totalDays:
 *                               type: integer
 *                               example: 90
 *                             startDate:
 *                               type: string
 *                               nullable: true
 *                               example: null
 *                     days:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day:
 *                             type: integer
 *                           isCompleted:
 *                             type: boolean
 *                           protocolItems:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                   example: diabetes-day-12
 *                                 type:
 *                                   type: string
 *                                   enum: [exercise, meditation]
 *                                 title:
 *                                   type: string
 *                                 subtitle:
 *                                   type: string
 *                                 durationMinutes:
 *                                   type: integer
 *                                 videoUrl:
 *                                   type: string
 *                                   nullable: true
 *                                 thumbnailUrl:
 *                                   type: string
 *                                   nullable: true
 *                                 requiresCamera:
 *                                   type: boolean
 *                                 exerciseKey:
 *                                   type: string
 *                                   nullable: true
 *                                   enum: [squat, chairExercise, standingSideStretch]
 *                                 targetReps:
 *                                   type: integer
 *                                   nullable: true
 *                                 targetSets:
 *                                   type: integer
 *                                   nullable: true
 *                                 isRequired:
 *                                   type: boolean
 *                                 isCompleted:
 *                                   type: boolean
 *                                 previousScore:
 *                                   type: integer
 *                                   nullable: true
 *                                 previousPostureScore:
 *                                   type: integer
 *                                   nullable: true
 *                                 previousAccuracyScore:
 *                                   type: integer
 *                                   nullable: true
 *                                 previousPaceScore:
 *                                   type: integer
 *                                   nullable: true
 *                     streak:
 *                       type: object
 *                       properties:
 *                         week:
 *                           type: array
 *                           items:
 *                             type: boolean
 *                           example: [true, true, false, true, false, false, false]
 *                     activity:
 *                       type: object
 *                       properties:
 *                         steps:
 *                           type: integer
 *                           example: 0
 *                         dailyGoalSteps:
 *                           type: integer
 *                           example: 10000
 *                         distanceKm:
 *                           type: number
 *                           example: 0
 *                         calories:
 *                           type: number
 *                           example: 0
 *       404:
 *         description: Not enrolled in any care plan
 */
router.get('/program/today', authenticate, getTodayProgram);

/**
 * @swagger
 * /exercise/camera-session/complete:
 *   post:
 *     summary: Save a completed camera-monitored exercise session
 *     description: Called when a camera session finishes (never on cancel). Scoring done on-device, persisted here.
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [exerciseId, complianceStatus]
 *             properties:
 *               exerciseId:
 *                 type: string
 *                 example: diabetes-day-12
 *               exerciseKey:
 *                 type: string
 *                 enum: [squat, chairExercise, standingSideStretch]
 *               durationSeconds:
 *                 type: integer
 *                 example: 180
 *               reps:
 *                 type: integer
 *                 example: 12
 *               targetReps:
 *                 type: integer
 *                 example: 15
 *               postureScore:
 *                 type: integer
 *                 example: 88
 *               accuracyScore:
 *                 type: integer
 *                 example: 80
 *               paceScore:
 *                 type: integer
 *                 example: 95
 *               exerciseScore:
 *                 type: integer
 *                 example: 87
 *               caloriesBurned:
 *                 type: integer
 *                 example: 22
 *               complianceStatus:
 *                 type: string
 *                 enum: [completed, partial, missed]
 *                 example: completed
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-20T10:15:00.000Z"
 *     responses:
 *       204:
 *         description: Session saved successfully
 */
router.post('/camera-session/complete', authenticate, completeCameraSession);

/**
 * @swagger
 * /exercise/compliance:
 *   get:
 *     summary: Get 7-day exercise compliance summary
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compliance data fetched successfully
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
 *                     targetMetPercent:
 *                       type: integer
 *                       example: 70
 *                     sessionsCompleted:
 *                       type: integer
 *                       example: 5
 *                     sessionsTarget:
 *                       type: integer
 *                       example: 7
 *                     avgHeartRate:
 *                       type: integer
 *                       nullable: true
 *                     avgDurationMinutes:
 *                       type: integer
 *                       example: 20
 *                     coachInsight:
 *                       type: string
 *                     historyRangeLabel:
 *                       type: string
 *                       example: 7-Day History
 *                     activityLog:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           exerciseId:
 *                             type: string
 *                           title:
 *                             type: string
 *                           subtitle:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [completed, missed]
 *                           exerciseScore:
 *                             type: integer
 *                             nullable: true
 *                           repsCompleted:
 *                             type: integer
 *                             nullable: true
 *                           targetReps:
 *                             type: integer
 *                             nullable: true
 */
router.get('/compliance', authenticate, getCompliance);

/**
 * @swagger
 * /wellness/history:
 *   get:
 *     summary: Get monthly wellness history with exercise and meditation stats
 *     tags: [Exercise]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wellness history fetched successfully
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
 *                     monthLabel:
 *                       type: string
 *                       example: August 2026
 *                     weeklyProgress:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: integer
 *                           dayLabel:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [completed, logged, none]
 *                           isToday:
 *                             type: boolean
 *                     exerciseStats:
 *                       type: object
 *                       properties:
 *                         primaryLabel:
 *                           type: string
 *                         primaryValue:
 *                           type: string
 *                         secondaryLabel:
 *                           type: string
 *                         secondaryValue:
 *                           type: string
 *                     meditationStats:
 *                       type: object
 *                       properties:
 *                         primaryLabel:
 *                           type: string
 *                         primaryValue:
 *                           type: string
 *                         secondaryLabel:
 *                           type: string
 *                         secondaryValue:
 *                           type: string
 *                     recentActivities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           dateLabel:
 *                             type: string
 *                           durationMinutes:
 *                             type: integer
 *                             nullable: true
 *                           intensity:
 *                             type: string
 *                             enum: [high, low, mental]
 *                           intensityLabel:
 *                             type: string
 */
router.get('/history', authenticate, getWellnessHistory);

module.exports = router;
