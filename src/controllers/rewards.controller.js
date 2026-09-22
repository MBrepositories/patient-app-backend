const rewardsService = require('../services/rewards.service');
const { success, error } = require('../utils/response');

const getRewardsSummary = async (req, res) => {
  try {
    const result = await rewardsService.getRewardsSummary(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getRewardsSummary };
