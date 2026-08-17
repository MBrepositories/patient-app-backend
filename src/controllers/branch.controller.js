const branchService = require('../services/branch.service');
const { success, error } = require('../utils/response');

const getBranches = async (req, res) => {
  try {
    const { status, region } = req.query;
    const result = await branchService.getBranches({ status, region });
    return success(res, result);
  } catch (err) {
    console.error('Branches error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

module.exports = { getBranches };
