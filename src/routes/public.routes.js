const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @swagger
 * /public/stats:
 *   get:
 *     summary: Get public app statistics (no auth required)
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: Stats fetched successfully
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
 *                     userCount:
 *                       type: integer
 *                       example: 1000000
 */
router.get('/stats', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS userCount FROM patients
       WHERE app_last_login IS NOT NULL OR app_password IS NOT NULL OR google_id IS NOT NULL OR apple_id IS NOT NULL`
    );
    return res.json({ success: true, data: { userCount: row.userCount } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Unable to fetch public statistics' });
  }
});

module.exports = router;
