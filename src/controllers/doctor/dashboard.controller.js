const dashboardService = require('../../services/doctor/dashboard.service');
const { success, error } = require('../../utils/response');

const getDashboardOverview = async (req, res) => {
  try {
    const result = await dashboardService.getDashboardOverview(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getDashboardOverview };
