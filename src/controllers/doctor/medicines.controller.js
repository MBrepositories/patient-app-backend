const { updateDosage } = require('../../services/doctor/medicines.service');
const { success, error } = require('../../utils/response');

const updatePatientDosage = async (req, res) => {
  try {
    const patientId    = parseInt(req.params.patientId);
    const medicationId = parseInt(req.params.medicationId);
    const { type, dosage } = req.body;

    if (!type || !dosage) {
      return error(res, 'type and dosage are required', 400);
    }

    const result = await updateDosage(req.user.id, patientId, medicationId, type, dosage);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { updatePatientDosage };
