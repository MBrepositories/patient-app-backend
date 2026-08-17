const medicinesService = require('../services/medicines.service');
const { success, error } = require('../utils/response');

const getMadhavbaugMedicinesMaster = async (req, res) => {
  try {
    const result = await medicinesService.getMadhavbaugMedicinesMaster();
    return success(res, result);
  } catch (err) {
    console.error('Madhavbaug medicines master error:', err);
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
    console.error('Allopathy medicines master error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

module.exports = { getMadhavbaugMedicinesMaster, getAllopathyMedicinesMaster };
