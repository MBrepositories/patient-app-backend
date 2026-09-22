const exerciseService = require('../services/exercise.service');
const { success, error } = require('../utils/response');

const getCarePlans = (req, res) => {
  try {
    const result = exerciseService.getCarePlans();
    return success(res, result);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

const getTodayProgram = async (req, res) => {
  try {
    const result = await exerciseService.getTodayProgram(req.user.id, req.query.planId);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const completeCameraSession = async (req, res) => {
  try {
    await exerciseService.completeCameraSession(req.user.id, req.body);
    return res.status(204).send();
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getCompliance = async (req, res) => {
  try {
    const result = await exerciseService.getCompliance(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getWellnessHistory = async (req, res) => {
  try {
    const result = await exerciseService.getWellnessHistory(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getCarePlans, getTodayProgram, completeCameraSession, getCompliance, getWellnessHistory };
