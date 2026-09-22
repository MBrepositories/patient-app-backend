const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getHistory } = require('../controllers/history.controller');

/**
 * @swagger
 * /history:
 *   get:
 *     summary: Get patient history timeline (vitals, bookings, diet, exercise, medical)
 *     tags: [History]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: History fetched successfully
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: vitals
 *                           label:
 *                             type: string
 *                             example: Vitals
 *                           iconName:
 *                             type: string
 *                             example: monitor-heart
 *                     records:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           categoryId:
 *                             type: string
 *                             enum: [medical, booking, vitals, diet, exercise]
 *                           title:
 *                             type: string
 *                           subtitle:
 *                             type: string
 *                           isoDate:
 *                             type: string
 *                             example: "2026-08-24"
 *                           statusLabel:
 *                             type: string
 *                           statusTone:
 *                             type: string
 *                             enum: [good, warning, bad, neutral]
 */
router.get('/', authenticate, getHistory);

module.exports = router;
