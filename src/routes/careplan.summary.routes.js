const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getCarePlanSummary, getTherapyDetail } = require('../services/careplan.summary.service');
const { success, error } = require('../utils/response');

/**
 * @swagger
 * /careplan/summary:
 *   get:
 *     summary: Get patient's care plan summary with programs, journey progress and quick links
 *     tags: [Careplans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Care plan summary fetched successfully
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
 *                     activePlansCount:
 *                       type: integer
 *                       example: 1
 *                     programs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: diabetes
 *                           tabLabel:
 *                             type: string
 *                             example: Diabetes
 *                           title:
 *                             type: string
 *                             example: Diabetes Reversal Program - 90 Days
 *                           currentDay:
 *                             type: integer
 *                             example: 12
 *                           totalDays:
 *                             type: integer
 *                             example: 90
 *                           overallPercent:
 *                             type: integer
 *                             example: 13
 *                           isPrimary:
 *                             type: boolean
 *                             example: true
 *                           tasks:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: string
 *                                 iconName:
 *                                   type: string
 *                                 label:
 *                                   type: string
 *                                 completed:
 *                                   type: integer
 *                                 target:
 *                                   type: integer
 *                     journeyProgress:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         completePercent:
 *                           type: integer
 *                           example: 13
 *                         currentDay:
 *                           type: integer
 *                           example: 12
 *                         totalDays:
 *                           type: integer
 *                           example: 90
 *                         daysRemaining:
 *                           type: integer
 *                           example: 78
 *                         rewardPoints:
 *                           type: integer
 *                           example: 250
 *                         startDate:
 *                           type: string
 *                           example: "1 Aug 2026"
 *                         endDate:
 *                           type: string
 *                           example: "29 Oct 2026"
 *                     dietChart:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         title:
 *                           type: string
 *                           example: Your Diet Chart
 *                         doctorName:
 *                           type: string
 *                           example: Dr. Suhas Hardas
 *                         conditionLabel:
 *                           type: string
 *                           example: For Diabetes
 *                     quickLinks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: survey
 *                           iconName:
 *                             type: string
 *                             example: assignment
 *                           label:
 *                             type: string
 *                             example: Survey
 *                           badgeCount:
 *                             type: integer
 *                             example: 2
 *                     therapies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: ecp-therapy
 *                           iconName:
 *                             type: string
 *                             example: show-chart
 *                           title:
 *                             type: string
 *                             example: ECP Therapy
 *                           subtitle:
 *                             type: string
 *                             example: "14 / 35 completed • Daily (Mon-Sat)"
 *                           percent:
 *                             type: integer
 *                             example: 40
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const result = await getCarePlanSummary(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /careplan/therapies/{id}:
 *   get:
 *     summary: Get therapy detail by ID (slug from careplan/summary therapies)
 *     tags: [Careplans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: ecp-therapy
 *     responses:
 *       200:
 *         description: Therapy detail fetched successfully
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
 *                       example: ecp-therapy
 *                     title:
 *                       type: string
 *                       example: ECP Therapy
 *                     schedule:
 *                       type: string
 *                       example: "Daily (Mon-Sat)"
 *                     completedSessions:
 *                       type: integer
 *                       example: 14
 *                     totalSessions:
 *                       type: integer
 *                       example: 35
 *                     nextSession:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         date:
 *                           type: string
 *                           example: "2026-10-08"
 *                         time:
 *                           type: string
 *                           nullable: true
 *                           example: "10:00 AM"
 *                         branchName:
 *                           type: string
 *                           nullable: true
 *                           example: Madhavbaug Clinic, Thane West
 *                     sessions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: "2026-10-08"
 *                           status:
 *                             type: string
 *                             enum: [completed, missed, upcoming]
 *       404:
 *         description: Therapy not found
 */
router.get('/therapies/:id', authenticate, async (req, res) => {
  try {
    const data = await getTherapyDetail(req.user.id, req.params.id);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

module.exports = router;
