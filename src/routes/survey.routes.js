const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getSurvey, submitSurvey } = require('../controllers/survey.controller');

/**
 * @swagger
 * /survey/weekly:
 *   get:
 *     summary: Get weekly survey questions and last submission
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Survey fetched successfully
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
 *                     weekLabel:
 *                       type: string
 *                       example: Week 34
 *                     dateRangeLabel:
 *                       type: string
 *                       example: August 2026
 *                     symptoms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           label:
 *                             type: string
 *                           value:
 *                             type: integer
 *                             example: 0
 *                     moods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           emoji:
 *                             type: string
 *                           label:
 *                             type: string
 *                           description:
 *                             type: string
 *                     selectedMoodId:
 *                       type: string
 *                       nullable: true
 *                       example: good
 *                     rewardPoints:
 *                       type: integer
 *                       example: 15
 */
router.get('/weekly', authenticate, getSurvey);

/**
 * @swagger
 * /survey/weekly:
 *   post:
 *     summary: Submit weekly survey
 *     tags: [Survey]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symptoms, moodId]
 *             properties:
 *               symptoms:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: headaches
 *                     value:
 *                       type: integer
 *                       example: 2
 *               moodId:
 *                 type: string
 *                 enum: [very-bad, bad, okay, good, great]
 *                 example: good
 *     responses:
 *       204:
 *         description: Survey submitted successfully
 */
router.post('/weekly', authenticate, submitSurvey);

module.exports = router;
