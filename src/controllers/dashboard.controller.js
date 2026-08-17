const dashboardService = require('../services/dashboard.service');
const { success, error } = require('../utils/response');

const getDashboardSummary = async (req, res) => {
  try {
    const summary = await dashboardService.getSummary(req.user.id, req.user.role);
    return success(res, summary);
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

module.exports = { getDashboardSummary };
