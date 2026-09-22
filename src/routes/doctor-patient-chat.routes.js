const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getChatHistory, sendMessage } = require('../controllers/doctor-patient-chat.controller');

/**
 * @swagger
 * /doctor-patient-chat:
 *   get:
 *     summary: Get unified doctor-patient-AI chat history
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history fetched successfully
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
 *                     doctorName:
 *                       type: string
 *                       example: Dr. Suhas Hardas
 *                     doctorSpecialty:
 *                       type: string
 *                       example: Endocrinologist
 *                     doctorInitials:
 *                       type: string
 *                       example: SH
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           kind:
 *                             type: string
 *                             enum: [message, activity]
 *                           id:
 *                             type: string
 *                           sender:
 *                             type: string
 *                             enum: [patient, doctor, ai]
 *                           senderName:
 *                             type: string
 *                           text:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [vitals, meal, exercise, doseChange]
 *                           summary:
 *                             type: string
 *                           timeLabel:
 *                             type: string
 */
router.get('/', authenticate, getChatHistory);

/**
 * @swagger
 * /doctor-patient-chat:
 *   post:
 *     summary: Send a message to the doctor-patient chat (AI auto-replies)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: Sir, I am suffering from fever
 *     responses:
 *       200:
 *         description: Message saved and AI reply returned
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
 *                     kind:
 *                       type: string
 *                       example: message
 *                     id:
 *                       type: string
 *                       example: msg-3
 *                     sender:
 *                       type: string
 *                       example: ai
 *                     senderName:
 *                       type: string
 *                       example: AiSHA AI
 *                     text:
 *                       type: string
 *                       example: Thanks for letting me know — Dr. Name will follow up here shortly.
 *                     timeLabel:
 *                       type: string
 *                       example: "Tue, 11:02 AM"
 */
router.post('/', authenticate, sendMessage);

module.exports = router;
