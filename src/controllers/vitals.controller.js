const vitalsService = require('../services/vitals.service');
const { success, error } = require('../utils/response');

const logWater = async (req, res) => {
  try {
    const { glasses } = req.body;
    const result = await vitalsService.logWater(req.user.id, glasses);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getWater = async (req, res) => {
  try {
    const result = await vitalsService.getWater(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getVitalsSummary = async (req, res) => {
  try {
    const result = await vitalsService.getVitalsSummary(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const logVitals = async (req, res) => {
  try {
    const result = await vitalsService.logVitals(req.user.id, req.body.readings);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getVitalsHistory = async (req, res) => {
  try {
    const result = await vitalsService.getVitalsHistory(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getVitalsSummary, logVitals, getVitalsHistory, logWater, getWater };
