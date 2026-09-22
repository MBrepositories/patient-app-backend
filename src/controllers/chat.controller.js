const chatService = require('../services/chat.service');
const { success, error } = require('../utils/response');

const getChatWelcome = (req, res) => {
  try {
    const result = chatService.getChatWelcome();
    return success(res, result);
  } catch (err) {
    console.error('Chat welcome error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

const sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return error(res, 'Message text is required.', 400);
    }
    const result = await chatService.sendMessage(req.user.id, text.trim());
    return success(res, result);
  } catch (err) {
    console.error('Chat message error:', err);
    return error(res, err.message || 'Something went wrong.', 500);
  }
};

module.exports = { getChatWelcome, sendMessage };
