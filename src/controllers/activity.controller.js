const activityService = require('../services/activity.service');
const { success, error } = require('../utils/response');

const getActivityMenu = (req, res) => {
  try {
    const result = activityService.getActivityMenu();
    return success(res, result);
  } catch (err) {
    console.error('Activity menu error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

module.exports = { getActivityMenu };
