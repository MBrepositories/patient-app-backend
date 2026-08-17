const db = require('../config/db');

// After OTP verification, link app_user to hospital patient
// Rules:
//   1. If phone found in patients table with a careplan → enrolled_patient (use latest careplan)
//   2. If phone found in patients table but no careplan → non_enrolled_patient
//   3. If phone found only in crm_leads → lead
//   4. Not found anywhere → unverified
const linkHospitalPatient = async (appUserId, phone) => {
  // Search patients table — get patient with latest enrolled careplan
  const [enrolledRows] = await db.query(
    `SELECT p.id FROM patients p
     INNER JOIN appointments a ON a.patient_id = p.id
     WHERE p.phone = ? AND a.careplan_id IS NOT NULL
     ORDER BY a.created_at DESC
     LIMIT 1`,
    [phone]
  );

  if (enrolledRows.length) {
    const hospitalPatientId = enrolledRows[0].id;
    await db.query(
      `UPDATE app_users SET hospital_patient_id = ?, verification_status = 'enrolled_patient', is_verified = 1 WHERE id = ?`,
      [hospitalPatientId, appUserId]
    );
    return { verificationStatus: 'enrolled_patient', hospitalPatientId };
  }

  // Check if phone exists in patients table without careplan
  const [patientRows] = await db.query(
    'SELECT id FROM patients WHERE phone = ? LIMIT 1',
    [phone]
  );

  if (patientRows.length) {
    const hospitalPatientId = patientRows[0].id;
    await db.query(
      `UPDATE app_users SET hospital_patient_id = ?, verification_status = 'non_enrolled_patient', is_verified = 1 WHERE id = ?`,
      [hospitalPatientId, appUserId]
    );
    return { verificationStatus: 'non_enrolled_patient', hospitalPatientId };
  }

  // Check crm_leads table
  const [leadRows] = await db.query(
    'SELECT id FROM crm_leads WHERE phone = ? ORDER BY created_at DESC LIMIT 1',
    [phone]
  );

  if (leadRows.length) {
    await db.query(
      `UPDATE app_users SET verification_status = 'lead', is_verified = 1 WHERE id = ?`,
      [appUserId]
    );
    return { verificationStatus: 'lead', hospitalPatientId: null };
  }

  // Not found anywhere
  await db.query(
    `UPDATE app_users SET is_verified = 1 WHERE id = ?`,
    [appUserId]
  );
  return { verificationStatus: 'unverified', hospitalPatientId: null };
};

module.exports = { linkHospitalPatient };
