const surveyService = require('../services/survey.service');
const { success, error } = require('../utils/response');

const getSurvey = async (req, res) => {
  try {
    const result = await surveyService.getSurvey(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const submitSurvey = async (req, res) => {
  try {
    await surveyService.submitSurvey(req.user.id, req.body);
    return res.status(204).send();
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getSurvey, submitSurvey };
