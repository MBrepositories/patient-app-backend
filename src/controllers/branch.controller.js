const branchService = require('../services/branch.service');
const { success, error } = require('../utils/response');

const getBranches = async (req, res) => {
  try {
    const { status, region } = req.query;
    const result = await branchService.getBranches({ status, region });
    return success(res, result);
  } catch (err) {
    console.error('Branches error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

const searchBranches = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return error(res, 'Please provide at least 2 characters to search.', 400);
    }

    const result = await branchService.searchBranches(query.trim());
    return success(res, result);
  } catch (err) {
    console.error('Branch search error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

const getNearestBranch = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return error(res, 'lat and lng query parameters are required.', 400);
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return error(res, 'lat and lng must be valid numbers.', 400);
    }

    const branch = await branchService.getNearestBranch(parsedLat, parsedLng);

    if (!branch) {
      return error(res, 'No branches found.', 404);
    }

    return success(res, { branch });
  } catch (err) {
    console.error('Nearest branch error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

module.exports = { getBranches, searchBranches, getNearestBranch };
