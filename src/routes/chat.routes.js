const express = require('express');
const router = express.Router();
const { getChatWelcome, sendMessage } = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /chat/welcome:
 *   get:
 *     summary: Get AI chat welcome screen data
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chat welcome data fetched successfully
 */
router.get('/welcome', authenticate, getChatWelcome);

/**
 * @swagger
 * /chat/message:
 *   post:
 *     summary: Send a message to Aisha AI assistant
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
 *                 example: "How was my BP yesterday?"
 *     responses:
 *       200:
 *         description: Assistant reply
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
 *                       example: "assistant-172000000"
 *                     sender:
 *                       type: string
 *                       example: "assistant"
 *                     text:
 *                       type: string
 *                       example: "Your blood pressure yesterday was 128/82 mmHg..."
 */
router.post('/message', authenticate, sendMessage);

module.exports = router;
