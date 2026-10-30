const express = require('express');
const router = express.Router();
const { getCareplans } = require('../controllers/careplan.controller');
const { getcareplanDetails } = require('../services/careplan.service');
const { success, error } = require('../utils/response');

/**
 * @swagger
 * /careplan-master:
 *   get:
 *     summary: Get all care plans
 *     tags: [Careplans]
 *     responses:
 *       200:
 *         description: Careplans fetched successfully
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
 *                     careplans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           plan_code:
 *                             type: string
 *                           care_plan_name:
 *                             type: string
 *                           type:
 *                             type: string
 *                           mrp:
 *                             type: number
 *                           discount_amount:
 *                             type: number
 *                           discount_percentage:
 *                             type: number
 *                           final_cost_to_patient:
 *                             type: number
 *                           duration_days:
 *                             type: integer
 *                           active_status:
 *                             type: integer
 *                             description: 1 = active, 0 = inactive
 *                           minimum_package_price:
 *                             type: number
 *                           maximum_package_price:
 *                             type: number
 */
router.get('/', getCareplans);

/**
 * @swagger
 * /careplan-master/{id}/details:
 *   get:
 *     summary: Get care plan details by ID
 *     tags: [Careplans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: careplan_master.id
 *     responses:
 *       200:
 *         description: Care plan details fetched successfully
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
 *                       type: integer
 *                       example: 561
 *                     name:
 *                       type: string
 *                       example: BMP 1
 *                     type:
 *                       type: string
 *                       example: Heart
 *                     mrp:
 *                       type: string
 *                       example: "85750.00"
 *                     finalCost:
 *                       type: string
 *                       example: "66350.00"
 *                     durationDays:
 *                       type: integer
 *                       nullable: true
 *                       example: 90
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     suitableFor:
 *                       type: array
 *                       example: []
 *                       description: Not available in DB yet
 *                       items:
 *                         type: string
 *                     inclusions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           iconName:
 *                             type: string
 *                             example: favorite-border
 *                           label:
 *                             type: string
 *                             example: ECP Therapy
 *                           count:
 *                             type: integer
 *                             nullable: true
 *                             example: 12
 *       404:
 *         description: Care plan not found
 */
router.get('/:id/details', async (req, res) => {
  try {
    const data = await getcareplanDetails(parseInt(req.params.id, 10));
    return success(res, data);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

module.exports = router;
