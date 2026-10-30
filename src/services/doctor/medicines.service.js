const db = require('../../config/db');

/**
 * Doctor updates a patient's medicine dosage (allopathy or madhavbaug).
 * After the update, a doseChange record is inserted into app_dose_changes
 * so it shows up as an activity in the doctor-patient chat thread.
 *
 * @param {number} doctorId     - logged-in doctor's users.id
 * @param {number} patientId    - patients.id
 * @param {number} medicationId - row id in patient_allopathy or patient_madhavbaug
 * @param {string} type         - 'allopathy' | 'madhavbaug'
 * @param {{ morning, afternoon, night, sos }} dosage
 */
const updateDosage = async (doctorId, patientId, medicationId, type, dosage) => {
  const { morning = 0, afternoon = 0, night = 0, sos = 0 } = dosage;

  let medicineName;

  if (type === 'allopathy') {
    const [[row]] = await db.query(
      `SELECT id, medicine_name FROM patient_allopathy WHERE id = ? LIMIT 1`,
      [medicationId]
    );
    if (!row) {
      const err = new Error('Medication not found');
      err.statusCode = 404;
      throw err;
    }
    medicineName = row.medicine_name;

    await db.query(
      `UPDATE patient_allopathy
       SET morning = ?, afternoon = ?, night = ?, other = ?
       WHERE id = ?`,
      [morning || null, afternoon || null, night || null, sos || null, medicationId]
    );

  } else if (type === 'madhavbaug') {
    const [[row]] = await db.query(
      `SELECT id, medicine_name FROM patient_madhavbaug WHERE id = ? LIMIT 1`,
      [medicationId]
    );
    if (!row) {
      const err = new Error('Medication not found');
      err.statusCode = 404;
      throw err;
    }
    medicineName = row.medicine_name;

    // Madhavbaug stores dosage as "M-A-N" string (or "SOS")
    const dosageStr = sos ? 'SOS' : `${morning}-${afternoon}-${night}`;
    await db.query(
      `UPDATE patient_madhavbaug SET dosage = ? WHERE id = ?`,
      [dosageStr, medicationId]
    );

  } else if (type === 'app') {
    const [[row]] = await db.query(
      `SELECT id, medicine_name FROM app_patient_medicines WHERE id = ? AND patient_id = ? LIMIT 1`,
      [medicationId, patientId]
    );
    if (!row) {
      const err = new Error('Medication not found');
      err.statusCode = 404;
      throw err;
    }
    medicineName = row.medicine_name;

    await db.query(
      `UPDATE app_patient_medicines
       SET morning = ?, afternoon = ?, night = ?, sos = ?, updated_at = NOW()
       WHERE id = ?`,
      [morning || 0, afternoon || 0, night || 0, sos ? 1 : 0, medicationId]
    );

  } else {
    const err = new Error('Invalid type. Must be allopathy, madhavbaug or app');
    err.statusCode = 400;
    throw err;
  }

  // Record the change so it appears in the doctor-patient chat activity feed
  await db.query(
    `INSERT INTO app_dose_changes
       (patient_id, doctor_id, medicine_id, medicine_type, medicine_name, morning, afternoon, night, sos)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [patientId, doctorId, medicationId, type, medicineName, morning, afternoon, night, sos]
  );

  return {
    medicationId: String(medicationId),
    type,
    medicineName,
    dosage: { morning, afternoon, night, sos },
  };
};

module.exports = { updateDosage };
