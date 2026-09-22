const db = require('../../config/db');
const { getCompliance } = require('../exercise.service');

const getPatientExerciseCompliance = async (doctorId, patientId) => {
  // Access control — patient must be in the same branch as the doctor
  const [[assigned]] = await db.query(
    `SELECT p.id FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id
     WHERE p.id = ? AND u.id = ? AND p.status = 'active'
     LIMIT 1`,
    [patientId, doctorId]
  );
  if (!assigned) throw Object.assign(new Error('Access denied. Patient not assigned to this doctor.'), { statusCode: 403 });

  return getCompliance(patientId);
};

module.exports = { getPatientExerciseCompliance };
