const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getDietCompliance, getDietChart, getCalorieEstimate, logMeal, getFoodsCatalog, searchFoods, logFood, uploadMealPhotoHandler } = require('../controllers/diet.controller');
const { uploadMealPhoto } = require('../middleware/upload');

// ─── /api/diet ────────────────────────────────────────────────────────────────
const dietRouter = express.Router();

/**
 * @swagger
 * /diet/compliance:
 *   get:
 *     summary: Get patient's diet compliance and weekly meal logging summary
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Diet compliance fetched successfully
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
 *                     adherencePercent:
 *                       type: integer
 *                       example: 73
 *                     mealsPerDayTarget:
 *                       type: integer
 *                       example: 3
 *                     trendLabel:
 *                       type: string
 *                       example: On track
 *                     weekLabel:
 *                       type: string
 *                       example: Week 34
 *                     proInsight:
 *                       type: string
 *                       example: Missing just one meal log per week can impact your score by 5%.
 *                     weeklyView:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dayLabel:
 *                             type: string
 *                             example: MON
 *                           mealsLogged:
 *                             type: integer
 *                             example: 2
 *                           mealsTarget:
 *                             type: integer
 *                             example: 3
 *                           isToday:
 *                             type: boolean
 *                             example: false
 *                     loggingConsistency:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dayLabel:
 *                             type: string
 *                             example: M
 *                           percent:
 *                             type: integer
 *                             example: 67
 *                           isToday:
 *                             type: boolean
 *                             example: false
 *                     recentHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "2026-08-25"
 *                           dateLabel:
 *                             type: string
 *                             example: Monday, August 25
 *                           mealsLogged:
 *                             type: integer
 *                             example: 2
 *                           mealsTarget:
 *                             type: integer
 *                             example: 3
 *                           meals:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 label:
 *                                   type: string
 *                                   example: BREAKFAST
 *                                 logged:
 *                                   type: boolean
 *                                   example: true
 *                                 photoUrl:
 *                                   type: string
 *                                   nullable: true
 *                                   example: /uploads/meals/meal-123-1724678400000.jpg
 */
dietRouter.get('/compliance', authenticate, getDietCompliance);

// ─── /api/dietchart ───────────────────────────────────────────────────────────
const dietchartRouter = express.Router();

/**
 * @swagger
 * /dietchart:
 *   get:
 *     summary: Get patient's personalised diet chart with schedule and guidelines
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Diet chart fetched successfully
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
 *                     title:
 *                       type: string
 *                       example: Your Personalised Diet Plan
 *                     subtitle:
 *                       type: string
 *                       example: Diabetes • 1800 kcal • Vegetarian
 *                     conditionType:
 *                       type: string
 *                       example: Diabetes
 *                     calories:
 *                       type: integer
 *                       example: 1800
 *                     foodPreference:
 *                       type: string
 *                       example: Vegetarian
 *                     language:
 *                       type: string
 *                       example: English
 *                     weight:
 *                       type: number
 *                       example: 72.5
 *                     height:
 *                       type: number
 *                       example: 168.0
 *                     bmi:
 *                       type: number
 *                       example: 25.7
 *                     guidelines:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Avoid refined sugar", "Drink 8 glasses of water daily"]
 *                     dietContentHtml:
 *                       type: string
 *                       nullable: true
 *                       example: "<p>Your diet plan content...</p>"
 *                     schedule:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mealTime:
 *                             type: string
 *                             example: "8:00 AM - Breakfast"
 *                           todayFood:
 *                             type: string
 *                             nullable: true
 *                             example: Oats with milk
 *                           allDays:
 *                             type: object
 *                             properties:
 *                               monday:
 *                                 type: string
 *                                 nullable: true
 *                               tuesday:
 *                                 type: string
 *                                 nullable: true
 *                               wednesday:
 *                                 type: string
 *                                 nullable: true
 *                               thursday:
 *                                 type: string
 *                                 nullable: true
 *                               friday:
 *                                 type: string
 *                                 nullable: true
 *                               saturday:
 *                                 type: string
 *                                 nullable: true
 *                               sunday:
 *                                 type: string
 *                                 nullable: true
 */
dietchartRouter.get('/', authenticate, getDietChart);

// ─── /api/meals ───────────────────────────────────────────────────────────────
const mealsRouter = express.Router();

/**
 * @swagger
 * /meals/calorie-estimate:
 *   get:
 *     summary: Get estimated calories for a meal period
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mealPeriod
 *         required: true
 *         schema:
 *           type: string
 *           enum: [breakfast, lunch, dinner, snack]
 *     responses:
 *       200:
 *         description: Calorie estimate returned
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
 *                     mealPeriod:
 *                       type: string
 *                       example: breakfast
 *                     estimatedCalories:
 *                       type: integer
 *                       example: 350
 */
mealsRouter.get('/calorie-estimate', authenticate, getCalorieEstimate);

/**
 * @swagger
 * /meals/log:
 *   post:
 *     summary: Log a meal for the patient
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mealPeriod]
 *             properties:
 *               mealPeriod:
 *                 type: string
 *                 enum: [breakfast, lunch, dinner, snack]
 *               hasPhoto:
 *                 type: boolean
 *               notes:
 *                 type: string
 *               timeLabel:
 *                 type: string
 *                 example: "12:30 PM"
 *               estimatedCalories:
 *                 type: number
 *     responses:
 *       200:
 *         description: Meal logged successfully
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
 *                       example: meal-1724678400000
 *                     loggedAtLabel:
 *                       type: string
 *                       example: "12:30 PM"
 */
mealsRouter.post('/log', authenticate, logMeal);

/**
 * @swagger
 * /meals/photo:
 *   post:
 *     summary: Upload a meal photo (max 1 per meal period per day)
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo, mealPeriod]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, WEBP or HEIC — max 10 MB)
 *               mealPeriod:
 *                 type: string
 *                 enum: [breakfast, lunch, dinner, snack]
 *     responses:
 *       200:
 *         description: Photo uploaded successfully
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
 *                     photoUrl:
 *                       type: string
 *                       example: /uploads/meals/meal-123-1724678400000.jpg
 *                     mealPeriod:
 *                       type: string
 *                       example: breakfast
 *       409:
 *         description: Photo already uploaded for this meal period today
 */
mealsRouter.post('/photo', authenticate, uploadMealPhoto, uploadMealPhotoHandler);

// ─── /api/foods ───────────────────────────────────────────────────────────────
const foodsRouter = express.Router();

/**
 * @swagger
 * /foods/catalog:
 *   get:
 *     summary: Get food catalog (common, recent, favorites tabs)
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Food catalog fetched successfully
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
 *                     tabs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: common
 *                           label:
 *                             type: string
 *                             example: Common
 *                     itemsByTab:
 *                       type: object
 *                       properties:
 *                         common:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FoodItem'
 *                         recent:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FoodItem'
 *                         favorites:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/FoodItem'
 */
foodsRouter.get('/catalog', authenticate, getFoodsCatalog);

/**
 * @swagger
 * /foods/search:
 *   get:
 *     summary: Search food items by name
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           example: roti
 *     responses:
 *       200:
 *         description: Search results returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FoodItem'
 */
foodsRouter.get('/search', authenticate, searchFoods);

/**
 * @swagger
 * /foods/log:
 *   post:
 *     summary: Log a food item for the patient
 *     tags: [Diet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mealPeriod, foodItemId, foodName]
 *             properties:
 *               mealPeriod:
 *                 type: string
 *                 enum: [breakfast, lunch, dinner, snack]
 *               foodItemId:
 *                 type: string
 *                 example: roti
 *               foodName:
 *                 type: string
 *                 example: Roti
 *               quantityLabel:
 *                 type: string
 *                 example: 1 piece
 *               calories:
 *                 type: number
 *                 example: 70
 *     responses:
 *       200:
 *         description: Food item logged successfully
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
 *                       example: food-log-1724678400000
 *                     loggedAtLabel:
 *                       type: string
 *                       example: Roti
 */
foodsRouter.post('/log', authenticate, logFood);

module.exports = { dietRouter, dietchartRouter, mealsRouter, foodsRouter };
