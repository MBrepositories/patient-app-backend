const patientsService = require('../../services/doctor/patients.service');
const { success, error } = require('../../utils/response');

const getPatients = async (req, res) => {
  try {
    const result = await patientsService.getPatients(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getPatients };
