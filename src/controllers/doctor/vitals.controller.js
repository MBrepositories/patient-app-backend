const { getPatientVitals } = require('../../services/doctor/vitals.service');
const { success, error } = require('../../utils/response');

const getPatientVitalsHandler = async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId, 10);
    const range = req.query.range || '30D';
    const result = await getPatientVitals(req.user.id, patientId, range);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getPatientVitalsHandler };
