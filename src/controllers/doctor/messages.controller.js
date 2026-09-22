const messagesService = require('../../services/doctor/messages.service');
const { success, error } = require('../../utils/response');

const getMessages = async (req, res) => {
  try {
    const { search, filter } = req.query;
    const result = await messagesService.getMessages(req.user.id, { search, filter });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getMessages };
