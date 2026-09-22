const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getNotifications, markOneRead, markAllRead } = require('../services/notifications.service');
const { success, error } = require('../utils/response');

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get patient's notification list
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
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
 *                     unreadCount:
 *                       type: integer
 *                       example: 3
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "1"
 *                           type:
 *                             type: string
 *                             enum: [appointment, medication, insight, vitals, lab]
 *                           title:
 *                             type: string
 *                             example: Cardiology Follow-up
 *                           message:
 *                             type: string
 *                             example: Your appointment with Dr. Aris Thorne is scheduled for tomorrow at 9:00 AM.
 *                           timestamp:
 *                             type: string
 *                             example: "2h ago"
 *                           isUnread:
 *                             type: boolean
 *                             example: true
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await getNotifications(req.user.id, { page });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   post:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    await markOneRead(req.user.id, parseInt(req.params.id));
    return res.json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await markAllRead(req.user.id);
    return res.json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

module.exports = router;
