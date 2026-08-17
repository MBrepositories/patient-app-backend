const express = require('express');
const router = express.Router();
const { getCareplans } = require('../controllers/careplan.controller');

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

module.exports = router;
