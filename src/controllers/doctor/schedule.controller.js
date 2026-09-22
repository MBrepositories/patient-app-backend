const scheduleService = require('../../services/doctor/schedule.service');
const { success, error } = require('../../utils/response');

const getDoctorSchedule = async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;
    const result = await scheduleService.getDoctorSchedule(req.user.id, { search, startDate, endDate });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getDoctorSchedule };
