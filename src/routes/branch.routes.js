const express = require('express');
const router = express.Router();
const { getBranches } = require('../controllers/branch.controller');

/**
 * @swagger
 * /branches:
 *   get:
 *     summary: Get all branches
 *     tags: [Branches]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *           default: active
 *         description: Filter branches by status (defaults to active)
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter branches by region name
 *     responses:
 *       200:
 *         description: Branches fetched successfully
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
 *                       example: 372
 *                     branches:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           branch_id:
 *                             type: integer
 *                           branch_name:
 *                             type: string
 *                           branch_code:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           email:
 *                             type: string
 *                           address:
 *                             type: string
 *                           city:
 *                             type: string
 *                           state:
 *                             type: string
 *                           pincode:
 *                             type: string
 *                           location:
 *                             type: string
 *                           website:
 *                             type: string
 *                           branch_description:
 *                             type: string
 *                           region:
 *                             type: string
 *                           status:
 *                             type: string
 */
router.get('/', getBranches);

module.exports = router;
