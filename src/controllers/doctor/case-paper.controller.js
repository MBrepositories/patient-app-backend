const casePaperService = require('../../services/doctor/case-paper.service');
const { success, error } = require('../../utils/response');

const getPatientCasePaper = async (req, res) => {
  try {
    const result = await casePaperService.getPatientCasePaper(req.user.id, req.params.patientId);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getPatientCasePaper };
