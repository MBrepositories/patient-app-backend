const foodLogsService = require('../../services/doctor/food-logs.service');
const { success, error } = require('../../utils/response');

const getFoodLogs = async (req, res) => {
  try {
    const { riskLevel, mealType, page } = req.query;
    const result = await foodLogsService.getFoodLogs({ riskLevel, mealType, page });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getFoodLogs };
