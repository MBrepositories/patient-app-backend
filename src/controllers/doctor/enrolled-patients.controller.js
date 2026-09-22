const enrolledPatientsService = require('../../services/doctor/enrolled-patients.service');
const { success, error } = require('../../utils/response');

const getEnrolledPatients = async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query;
    const result = await enrolledPatientsService.getEnrolledPatients(req.user.id, { search, status, startDate, endDate });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const searchPatients = async (req, res) => {
  try {
    const { query } = req.query;
    const result = await enrolledPatientsService.searchPatients(query);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const enrollPatient = async (req, res) => {
  try {
    const result = await enrolledPatientsService.enrollPatient(req.user.id, req.body);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getEnrolledPatients, searchPatients, enrollPatient };
