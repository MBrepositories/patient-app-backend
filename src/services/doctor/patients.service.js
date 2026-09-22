const db = require('../../config/db');

const getPatients = async (doctorId) => {
  // Get doctor's branch
  const [[doctor]] = await db.query(
    `SELECT branch_id FROM users WHERE id = ? LIMIT 1`,
    [doctorId]
  );
  if (!doctor) return [];

  const branchId = doctor.branch_id;

  // Get all patient IDs from branch that have any app activity
  const [patientIdRows] = await db.query(
    `SELECT DISTINCT p.id
     FROM patients p
     WHERE p.branch_id = ? AND p.status = 'active'
       AND (
         EXISTS (SELECT 1 FROM app_patient_careplans apc WHERE apc.app_user_id = p.id)
         OR EXISTS (SELECT 1 FROM app_chat_messages acm WHERE acm.patient_id = p.id)
         OR EXISTS (SELECT 1 FROM app_meal_photos amp WHERE amp.patient_id = p.id)
         OR EXISTS (SELECT 1 FROM app_vitals av WHERE av.app_user_id = p.id)
       )`,
    [branchId]
  );

  if (!patientIdRows.length) return [];

  const patientIds = patientIdRows.map(r => r.id);

  // Fetch full patient details + latest BP
  const [rows] = await db.query(
    `SELECT
       p.id, p.patient_name, p.phone, p.email, p.patient_id AS uhid,
       pv.blood_pressure_systolic AS systolic,
       pv.blood_pressure_diastolic AS diastolic
     FROM patients p
     LEFT JOIN (
       SELECT patient_id, blood_pressure_systolic, blood_pressure_diastolic
       FROM patient_vitals
       WHERE status = 'recorded' AND blood_pressure_systolic IS NOT NULL
       ORDER BY recorded_at DESC
     ) pv ON pv.patient_id = p.id
     WHERE p.id IN (?)`,
    [patientIds]
  );

  // Deduplicate by patient id
  const seen = new Set();
  const patients = [];
  for (const r of rows) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      patients.push(r);
    }
  }

  return patients.map(r => {
    const systolic = r.systolic || 0;
    const severity = systolic > 160 ? 'critical' : systolic >= 140 ? 'warning' : 'none';
    const bpStatus = systolic > 140 ? 'high' : 'normal';
    const bpValue  = systolic ? `${systolic} mmHg` : 'N/A';

    return {
      id:              `patient-${r.id}`,
      patientDbId:     r.id,
      name:            r.patient_name || 'Unknown',
      email:           r.email || '',
      phone:           r.phone || '',
      severity,
      bpValue,
      bpStatus,
      heartRateValue:  'N/A',
      patientIdLabel:  r.uhid || String(r.id),
    };
  });
};

module.exports = { getPatients };
