const appointmentsService = require('../services/appointments.service');
const { success, error } = require('../utils/response');



const getBookingOptions = async (req, res) => {
  try {
    const result = await appointmentsService.getBookingOptions(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getDoctorProfile = async (req, res) => {
  try {
    const result = await appointmentsService.getDoctorProfile(req.params.doctorId, req.query.date || null);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const bookAppointment = async (req, res) => {
  try {
    const { doctorId, isoDate, dateLabel, timeSlot, branchId } = req.body;
    const result = await appointmentsService.bookAppointment(req.user.id, { doctorId, isoDate, dateLabel, timeSlot, branchId });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getAppointmentsList = async (req, res) => {
  try {
    const result = await appointmentsService.getAppointmentsList(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getAppointmentSummary = async (req, res) => {
  try {
    const result = await appointmentsService.getAppointmentSummary(req.user.id, req.params.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getRescheduleOptions = async (req, res) => {
  try {
    const result = await appointmentsService.getRescheduleOptions(req.user.id, req.params.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const confirmReschedule = async (req, res) => {
  try {
    const { newDateIso, newTimeLabel, reason } = req.body;
    const result = await appointmentsService.confirmReschedule(req.user.id, req.params.id, { newDateIso, newTimeLabel, reason });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getCancelOptions = async (req, res) => {
  try {
    const result = await appointmentsService.getCancelOptions(req.user.id, req.params.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const confirmCancel = async (req, res) => {
  try {
    const { reasonId, comments } = req.body;
    const result = await appointmentsService.confirmCancel(req.user.id, req.params.id, { reasonId, comments });
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getBookingOptions, getDoctorProfile, bookAppointment, getAppointmentsList, getAppointmentSummary, getRescheduleOptions, confirmReschedule, getCancelOptions, confirmCancel };
