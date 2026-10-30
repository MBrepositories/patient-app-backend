const { getPatientSleep } = require('../../services/doctor/sleep.service');

const getPatientSleepHandler = async (req, res, next) => {
  try {
    const doctorId  = req.user.id;
    const patientId = parseInt(req.params.patientId, 10);
    const { from, to } = req.query;
    const data = await getPatientSleep(doctorId, patientId, { from, to });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPatientSleepHandler };
