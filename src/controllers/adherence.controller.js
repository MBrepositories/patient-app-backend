const adherenceService = require('../services/adherence.service');
const { success, error } = require('../utils/response');

const get7DayAdherence = async (req, res) => {
  try {
    const result = await adherenceService.get7DayAdherence(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { get7DayAdherence };
