const dietService = require('../services/diet.service');
const { success, error } = require('../utils/response');

const getDietCompliance = async (req, res) => {
  try {
    const result = await dietService.getDietCompliance(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getDietChart = async (req, res) => {
  try {
    const result = await dietService.getDietChart(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getCalorieEstimate = async (req, res) => {
  try {
    const result = await dietService.getCalorieEstimate(req.query.mealPeriod);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const logMeal = async (req, res) => {
  try {
    const { mealPeriod, hasPhoto, notes, timeLabel, estimatedCalories } = req.body;
    const result = await dietService.logMeal(req.user.id, { mealPeriod, hasPhoto, notes, timeLabel, estimatedCalories });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getFoodsCatalog = async (req, res) => {
  try {
    const result = await dietService.getFoodsCatalog(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const searchFoods = async (req, res) => {
  try {
    const result = await dietService.searchFoods(req.query.query);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const logFood = async (req, res) => {
  try {
    const { mealPeriod, foodItemId, foodName, quantityLabel, calories } = req.body;
    const result = await dietService.logFood(req.user.id, { mealPeriod, foodItemId, foodName, quantityLabel, calories });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const uploadMealPhotoHandler = async (req, res) => {
  try {
    if (!req.file) return error(res, 'No photo uploaded.', 400);

    const VALID_PERIODS = ['breakfast', 'lunch', 'dinner', 'snack'];
    const mealPeriod = (req.body.mealPeriod || '').toLowerCase();
    if (!VALID_PERIODS.includes(mealPeriod)) {
      // Delete the uploaded file since request is invalid
      require('fs').unlinkSync(req.file.path);
      return error(res, 'mealPeriod is required. Use breakfast, lunch, dinner or snack.', 400);
    }

    const result = await dietService.uploadMealPhoto(req.user.id, mealPeriod, req.file);
    return success(res, result);
  } catch (err) {
    // Clean up file if something went wrong after upload
    if (req.file) {
      try { require('fs').unlinkSync(req.file.path); } catch (_) {}
    }
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getDietCompliance, getDietChart, getCalorieEstimate, logMeal, getFoodsCatalog, searchFoods, logFood, uploadMealPhotoHandler };
