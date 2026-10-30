const patientsService = require('../../services/doctor/patients.service');
const { success, error } = require('../../utils/response');

const getPatients = async (req, res) => {
  try {
    const { page, pageSize } = req.query;
    const result = await patientsService.getPatients(req.user.id, {
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20,
    });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getPatients };
