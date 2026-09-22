const appointmentsService = require('../../services/doctor/appointments.service');
const { success, error } = require('../../utils/response');

const getAppointmentDetails = async (req, res) => {
  try {
    const result = await appointmentsService.getAppointmentDetails(req.params.appointmentId);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getVisitSession = async (req, res) => {
  try {
    const result = await appointmentsService.getVisitSession(req.params.appointmentId);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const completeVisit = async (req, res) => {
  try {
    const result = await appointmentsService.completeVisit(req.params.appointmentId, req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getRescheduleOptions = async (req, res) => {
  try {
    const result = await appointmentsService.getRescheduleOptions(req.params.appointmentId, req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const confirmReschedule = async (req, res) => {
  try {
    const result = await appointmentsService.confirmReschedule(req.params.appointmentId, req.user.id, req.body);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getCancelOptions = async (req, res) => {
  try {
    const result = await appointmentsService.getCancelOptions(req.params.appointmentId, req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const confirmCancel = async (req, res) => {
  try {
    const result = await appointmentsService.confirmCancel(req.params.appointmentId, req.user.id, req.body);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getAppointmentDetails, getVisitSession, completeVisit, getRescheduleOptions, confirmReschedule, getCancelOptions, confirmCancel };
