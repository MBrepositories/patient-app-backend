const db = require('../../config/db');

const getPatients = async (doctorId, { page = 1, pageSize = 20 } = {}) => {
  // Get doctor's branch
  const [[doctor]] = await db.query(
    `SELECT branch_id FROM users WHERE id = ? LIMIT 1`,
    [doctorId]
  );
  if (!doctor) return [];

  const branchId = doctor.branch_id;

  // Get all patient IDs: app enrolled + clinic care plans + app activity
  const [patientIdRows] = await db.query(
    `SELECT DISTINCT p.id
     FROM patients p
     WHERE p.branch_id = ? AND p.status = 'active'
       AND (
         -- App enrolled
         EXISTS (SELECT 1 FROM app_patient_careplans apc WHERE apc.app_user_id = p.id AND apc.doctor_id = ?)
         -- Clinic software care plans linked to this doctor
         OR EXISTS (
           SELECT 1 FROM patient_careplans pcl
           INNER JOIN appointments a ON a.id = pcl.appointment_id
           WHERE pcl.patient_id = p.id AND pcl.status = 'active'
             AND (a.doctor_id = ? OR (IFNULL(a.doctor_id, 0) = 0 AND a.created_by = ?))
         )
         -- App activity (chat, vitals, meal photos)
         OR EXISTS (SELECT 1 FROM app_chat_messages acm WHERE acm.patient_id = p.id)
         OR EXISTS (SELECT 1 FROM app_vitals av WHERE av.app_user_id = p.id)
         OR EXISTS (SELECT 1 FROM app_meal_photos amp WHERE amp.patient_id = p.id)
       )`,
    [branchId, doctorId, doctorId, doctorId]
  );

  if (!patientIdRows.length) return [];

  const patientIds = patientIdRows.map(r => r.id);

  // Fetch full patient details + latest BP + last activity
  const [rows] = await db.query(
    `SELECT
       p.id, p.patient_name, p.phone, p.email, p.patient_id AS uhid,
       pv.blood_pressure_systolic AS systolic,
       pv.blood_pressure_diastolic AS diastolic,
       GREATEST(
         COALESCE((SELECT MAX(logged_at)  FROM app_meal_logs      WHERE patient_id   = p.id), '1970-01-01'),
         COALESCE((SELECT MAX(logged_at)  FROM app_vitals         WHERE app_user_id  = p.id), '1970-01-01'),
         COALESCE((SELECT MAX(logged_at)  FROM app_medicine_logs  WHERE app_user_id  = p.id), '1970-01-01'),
         COALESCE((SELECT MAX(created_at) FROM app_exercise_sessions WHERE app_user_id = p.id), '1970-01-01'),
         COALESCE((SELECT MAX(created_at) FROM app_chat_messages  WHERE patient_id   = p.id), '1970-01-01'),
         COALESCE((SELECT MAX(logged_at)  FROM app_steps_log      WHERE app_user_id  = p.id), '1970-01-01')
       ) AS last_active_at
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

  const total = patients.length;
  const offset = (page - 1) * pageSize;
  const paginated = patients.slice(offset, offset + pageSize);

  return {
    totalCount: total,
    page,
    pageSize,
    patients: paginated.map(r => {
      const systolic = r.systolic || 0;
      const severity = systolic > 160 ? 'critical' : systolic >= 140 ? 'warning' : 'none';
      const bpStatus = systolic > 140 ? 'high' : 'normal';
      const bpValue  = systolic ? `${systolic} mmHg` : 'N/A';

      const lastActiveAt = (r.last_active_at && new Date(r.last_active_at).getFullYear() > 1970)
        ? new Date(r.last_active_at).toISOString()
        : null;
      const isActive = lastActiveAt
        ? (Date.now() - new Date(lastActiveAt).getTime()) < 7 * 24 * 60 * 60 * 1000
        : false;

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
        lastActiveAt,
        activityStatus:  isActive ? 'active' : 'inactive',
      };
    }),
  };
};

module.exports = { getPatients };
