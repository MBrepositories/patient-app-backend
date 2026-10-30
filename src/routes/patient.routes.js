const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getPatientMedicines } = require('../controllers/medicines.controller');
const { getPopups, dismissPopup } = require('../services/popups.service');

/**
 * @swagger
 * /patient/medicines:
 *   get:
 *     summary: Get patient's prescribed medicines
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prescribed medicines fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 medicines:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: app-2
 *                       type:
 *                         type: string
 *                         enum: [madhavbaug, allopathy, app]
 *                         description: Source type. Use "category" field for display tab of "app" medicines.
 *                       category:
 *                         type: string
 *                         enum: [madhavbaug, allopathy]
 *                         nullable: true
 *                         description: Display tab for app-type medicines. Use this to show in the correct Allopathy/Madhavbaug tab.
 *                         example: allopathy
 *                       name:
 *                         type: string
 *                       formLabel:
 *                         type: string
 *                       doses:
 *                         type: object
 *                       instructions:
 *                         type: string
 *                         nullable: true
 *                       courseDays:
 *                         type: integer
 *                         nullable: true
 *                       startDate:
 *                         type: string
 *                         nullable: true
 *                       doctorName:
 *                         type: string
 *                         nullable: true
 */
router.get('/medicines', authenticate, getPatientMedicines);

/**
 * @swagger
 * /patient/popups:
 *   get:
 *     summary: Get active popups for the logged-in patient
 *     description: Returns all active, non-expired, non-dismissed popups that match the patient's branch and careplan.
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Popups fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 popups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       title:
 *                         type: string
 *                         example: "Welcome!"
 *                       message:
 *                         type: string
 *                         example: "Track your health daily."
 *                       imageUrl:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       type:
 *                         type: string
 *                         enum: [manual, auto]
 *                         example: manual
 *                       actionLabel:
 *                         type: string
 *                         nullable: true
 *                         example: "Learn More"
 *                       actionUrl:
 *                         type: string
 *                         nullable: true
 *                         example: null
 */
router.get('/popups', authenticate, async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const popups = await getPopups(patientId);
    res.json({ success: true, popups });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /patient/popups/{id}/dismiss:
 *   post:
 *     summary: Dismiss a popup permanently
 *     description: Marks the popup as dismissed for this patient (won't show again) and adds it to patient notifications.
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Popup ID
 *     responses:
 *       200:
 *         description: Popup dismissed successfully
 *       404:
 *         description: Popup not found
 */
router.post('/popups/:id/dismiss', authenticate, async (req, res, next) => {
  try {
    const patientId = req.user.id;
    const popupId   = parseInt(req.params.id, 10);
    if (!popupId) return res.status(400).json({ success: false, message: 'Invalid popup id' });
    await dismissPopup(patientId, popupId);
    res.json({ success: true, message: 'Popup dismissed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
