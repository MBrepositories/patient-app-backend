const historyService = require('../services/history.service');
const { success, error } = require('../utils/response');

const getHistory = async (req, res) => {
  try {
    const result = await historyService.getHistory(req.user.id);
    return success(res, result);
  } catch (err) {
    console.error('History error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

module.exports = { getHistory };
