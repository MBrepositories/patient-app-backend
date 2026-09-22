const exerciseComplianceService = require('../../services/doctor/exercise-compliance.service');
const { success, error } = require('../../utils/response');

const getPatientExerciseCompliance = async (req, res) => {
  try {
    const result = await exerciseComplianceService.getPatientExerciseCompliance(req.user.id, req.params.patientId);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getPatientExerciseCompliance };
