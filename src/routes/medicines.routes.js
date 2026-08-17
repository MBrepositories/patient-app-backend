const express = require('express');
const router = express.Router();
const { getMadhavbaugMedicinesMaster, getAllopathyMedicinesMaster } = require('../controllers/medicines.controller');

/**
 * @swagger
 * /medicines/madhavbaug/master:
 *   get:
 *     summary: Get all active Madhavbaug medicines (master sync)
 *     tags: [Medicines]
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
router.get('/madhavbaug/master', getMadhavbaugMedicinesMaster);

/**
 * @swagger
 * /medicines/allopathy/master:
 *   get:
 *     summary: Get all active Allopathy medicines (master sync)
 *     tags: [Medicines]
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
router.get('/allopathy/master', getAllopathyMedicinesMaster);

module.exports = router;
