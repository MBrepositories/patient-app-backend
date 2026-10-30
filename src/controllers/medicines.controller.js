const medicinesService = require('../services/medicines.service');
const { success, error } = require('../utils/response');

const getMadhavbaugMedicinesMaster = async (req, res) => {
  try {
    const result = await medicinesService.getMadhavbaugMedicinesMaster();
    return success(res, result);
  } catch (err) {
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

const getAllopathyMedicinesMaster = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return error(res, 'Please provide at least 2 characters to search.', 400);
    }
    const result = await medicinesService.getAllopathyMedicinesMaster(query.trim());
    return success(res, result);
  } catch (err) {
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

const getMedicinesSummary = async (req, res) => {
  try {
    const result = await medicinesService.getMedicinesSummary(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const markDoseTaken = async (req, res) => {
  try {
    const { medicationId } = req.params;
    const { slot, taken, type } = req.body;
    await medicinesService.markDoseTaken(req.user.id, medicationId, { slot, taken, type });
    return res.status(204).send();
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getMedicineAdherence = async (req, res) => {
  try {
    const result = await medicinesService.getMedicineAdherence(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getPatientMedicines = async (req, res) => {
  try {
    const result = await medicinesService.getPatientMedicines(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = {
  getMadhavbaugMedicinesMaster,
  getAllopathyMedicinesMaster,
  getMedicinesSummary,
  markDoseTaken,
  getMedicineAdherence,
  getPatientMedicines,
};
