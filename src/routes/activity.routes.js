const express = require('express');
const router = express.Router();
const { getActivityMenu } = require('../controllers/activity.controller');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /activity/menu:
 *   get:
 *     summary: Get activity menu options
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity menu fetched successfully
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
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           subtitle:
 *                             type: string
 *                           iconName:
 *                             type: string
 *                           iconColor:
 *                             type: string
 *                           chips:
 *                             type: array
 *                             items:
 *                               type: string
 *                     tip:
 *                       type: string
 */
router.get('/menu', authenticate, getActivityMenu);

module.exports = router;
