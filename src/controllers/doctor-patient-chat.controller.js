const chatService = require('../services/doctor-patient-chat.service');
const { success, error } = require('../utils/response');

const getChatHistory = async (req, res) => {
  try {
    const result = await chatService.getChatHistory(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return error(res, 'text is required', 400);
    }
    const result = await chatService.sendMessage(req.user.id, text.trim());
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getChatHistory, sendMessage };
