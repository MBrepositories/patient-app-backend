const { socialLogin } = require('../services/social.auth.service');
const { success, error } = require('../utils/response');

const socialLoginHandler = async (req, res) => {
  try {
    const { provider, idToken, role } = req.body;
    if (!provider || !idToken || !role) {
      return error(res, 'provider, idToken and role are required.', 400);
    }
    const result = await socialLogin({ provider, idToken, role });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { socialLoginHandler };
