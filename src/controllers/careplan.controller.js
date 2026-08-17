const careplanService = require('../services/careplan.service');
const { success, error } = require('../utils/response');

const getCareplans = async (req, res) => {
  try {
    const result = await careplanService.getCareplans();
    return success(res, result);
  } catch (err) {
    console.error('Careplans error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

module.exports = { getCareplans };
