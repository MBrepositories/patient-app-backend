const profileService = require('../services/profile.service');
const { success, error } = require('../utils/response');

const getProfile = async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.user.id);
    return success(res, profile);
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

const updateProfile = async (req, res) => {
  try {
    const profile = await profileService.updateProfile(req.user.id, req.body);
    return success(res, profile);
  } catch (err) {
    return error(res, err.message, err.statusCode || 400);
  }
};

module.exports = { getProfile, updateProfile };
