const express = require('express');
const router = express.Router();
const { getMadhavbaugMedicinesMaster, getAllopathyMedicinesMaster, getMedicinesSummary, markDoseTaken, getMedicineAdherence, getPatientMedicines } = require('../controllers/medicines.controller');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /medicines/madhavbaug/master:
 *   get:
 *     summary: Get all active Madhavbaug medicines (master sync)
 *     tags: [Medicines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Madhavbaug medicines fetched successfully
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
 *                     total:
 *                       type: integer
 *                     medicines:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           batch_number:
 *                             type: string
 *                           expiry_date:
 *                             type: string
 *                           uom:
 *                             type: string
 *                           dosage:
 *                             type: string
 *                           price:
 *                             type: number
 *                           category:
 *                             type: string
 *                           status:
 *                             type: string
 *                           medium:
 *                             type: string
 *                           route:
 *                             type: string
 *                           frequency:
 *                             type: string
 *                           duration:
 *                             type: integer
 */
router.get('/madhavbaug/master', authenticate, getMadhavbaugMedicinesMaster);

/**
 * @swagger
 * /medicines/allopathy/master:
 *   get:
 *     summary: Get all active Allopathy medicines (master sync)
 *     tags: [Medicines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search medicine by name (minimum 2 characters)
 *     responses:
 *       200:
 *         description: Allopathy medicines fetched successfully
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
 *                     total:
 *                       type: integer
 *                     medicines:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           medicine_name:
 *                             type: string
 *                           uom:
 *                             type: string
 *                           default_dosage:
 *                             type: string
 *                           default_frequency:
 *                             type: string
 *                           manufacturer:
 *                             type: string
 *                           salt:
 *                             type: string
 *                           mrp:
 *                             type: number
 *                           status:
 *                             type: string
 *                           uses:
 *                             type: string
 *                           side_effects:
 *                             type: string
 *                           how_to_use:
 *                             type: string
 *                           habit_forming:
 *                             type: string
 *                           therapeutic_class:
 *                             type: string
 */
router.get('/allopathy/master', authenticate, getAllopathyMedicinesMaster);

/**
 * @swagger
 * /medicines/summary:
 *   get:
 *     summary: Get patient's Madhavbaug and Allopathy medicines with today's taken status
 *     tags: [Medicines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Medicines summary fetched successfully
 */
router.get('/summary', authenticate, getMedicinesSummary);

/**
 * @swagger
 * /medicines/{medicationId}/mark-taken:
 *   post:
 *     summary: Mark a dose slot as taken or untaken
 *     tags: [Medicines]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: medicationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: medicine ID (from medicines summary response)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slot, taken, type]
 *             properties:
 *               slot:
 *                 type: string
 *                 enum: [morning, afternoon, night, sos]
 *                 example: morning
 *               taken:
 *                 type: boolean
 *                 example: true
 *               type:
 *                 type: string
 *                 enum: [madhavbaug, allopathy, app]
 *                 example: madhavbaug
 *                 description: Use "app" for doctor-added medicines. Pass numeric id (e.g. 2 for "app-2") in the path.
 *     responses:
 *       204:
 *         description: Dose marked successfully
 */
router.post('/:medicationId/mark-taken', authenticate, markDoseTaken);

/**
 * @swagger
 * /medicine/adherence:
 *   get:
 *     summary: Get 7-day medicine adherence per medication
 *     tags: [Medicines]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Medicine adherence fetched successfully
 */
router.get('/adherence', authenticate, getMedicineAdherence);

router.get('/prescribed', authenticate, getPatientMedicines);

module.exports = router;
