const stepsService = require('../services/steps.service');
const { success, error } = require('../utils/response');


const getStepsDetail = async (req, res) => {
  try {
    const result = await stepsService.getStepsDetail(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const syncSteps = async (req, res) => {
  try {
    const { steps, date } = req.body;
    await stepsService.syncSteps(req.user.id, steps, date || null);
    return res.status(200).json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const syncStepsHistory = async (req, res) => {
  try {
    await stepsService.syncStepsHistory(req.user.id, req.body);
    return res.status(200).json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getWalkingDetail = async (req, res) => {
  try {
    const result = await stepsService.getWalkingDetail(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const syncWalking = async (req, res) => {
  try {
    const { steps } = req.body;
    await stepsService.syncWalking(req.user.id, steps);
    return res.status(200).json({ success: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getStepsDetail, syncSteps, syncStepsHistory, getWalkingDetail, syncWalking };
