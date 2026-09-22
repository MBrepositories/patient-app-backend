const express = require('express');
const router = express.Router();
const { getBranches, searchBranches, getNearestBranch } = require('../controllers/branch.controller');
const { authenticate } = require('../middleware/auth');

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

/**
 * @swagger
 * /branches/search:
 *   get:
 *     summary: Search branches by name, city, pincode or address
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search term (branch name, city, pincode or address)
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
 *                     branches:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           branch_id:
 *                             type: integer
 *                           branch_name:
 *                             type: string
 *                           city:
 *                             type: string
 *                           pincode:
 *                             type: string
 *                           address:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           region:
 *                             type: string
 */
router.get('/search', authenticate, searchBranches);

/**
 * @swagger
 * /branches/nearest:
 *   get:
 *     summary: Get nearest branch based on user location
 *     tags: [Branches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: User's latitude
 *         example: 18.9750
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: User's longitude
 *         example: 72.8258
 *     responses:
 *       200:
 *         description: Nearest branch fetched successfully
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
 *                     branch:
 *                       type: object
 *                       properties:
 *                         branch_id:
 *                           type: integer
 *                         branch_name:
 *                           type: string
 *                         city:
 *                           type: string
 *                         pincode:
 *                           type: string
 *                         address:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         distance_km:
 *                           type: string
 *                           example: "1.25"
 */
router.get('/nearest', authenticate, getNearestBranch);

module.exports = router;
