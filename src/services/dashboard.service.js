const db = require('../config/db');

const getSummary = async (userId) => {
  // Get app_user with hospital_patient_id
  const [userRows] = await db.query(
    'SELECT hospital_patient_id FROM app_users WHERE id = ?',
    [userId]
  );
  const user = userRows[0];
  const patientId = user ? user.hospital_patient_id : null;

  const [appointments, vitals] = await Promise.all([
    getAppointments(patientId),
    getLatestVitals(patientId),
  ]);

  return {
    // App-generated fields — returned as defaults (frontend handles these)
    streak: { days: 0 },
    goals: { completed: 0, target: 0, completionMessage: '' },
    vitals: { logged: 0, target: 3 },
    steps: { count: 0 },
    points: { total: 0 },
    compliance: {
      dietPercent: 0,
      exercisePercent: 0,
      medicinePercent: 0,
      sleepAvgHours: 0,
      stepsAvgPerDay: 0,
    },
    // Hospital DB data
    reversalJourney: vitals,
    appointments,
  };
};

const getAppointments = async (patientId) => {
  if (!patientId) return [];

  const [rows] = await db.query(
    `SELECT
       a.appointment_id        AS id,
       DATE_FORMAT(a.appointment_date, '%b %d, %Y') AS date,
       DATE_FORMAT(a.appointment_time, '%h:%i %p')  AS time,
       a.appointment_type      AS type,
       a.status,
       b.branch_name           AS location
     FROM appointments a
     LEFT JOIN branches b ON b.id = a.branch_id
     WHERE a.patient_id = ?
       AND a.appointment_date >= CURDATE()
       AND a.status NOT IN ('cancelled', 'no-show')
     ORDER BY a.appointment_date ASC, a.appointment_time ASC
     LIMIT 5`,
    [patientId]
  );

  return rows;
};

const getLatestVitals = async (patientId) => {
  if (!patientId) {
    return { stage: null, hba1cLevel: null, weightLossKg: null };
  }

  // Get latest vitals
  const [latestRows] = await db.query(
    `SELECT blood_sugar_hba1c, weight
     FROM patient_vitals
     WHERE patient_id = ? AND status = 'recorded'
     ORDER BY recorded_at DESC LIMIT 1`,
    [patientId]
  );

  // Get first recorded vitals (for weight loss calculation)
  const [firstRows] = await db.query(
    `SELECT weight
     FROM patient_vitals
     WHERE patient_id = ? AND status = 'recorded'
     ORDER BY recorded_at ASC LIMIT 1`,
    [patientId]
  );

  const latest = latestRows[0];
  const first = firstRows[0];

  if (!latest) {
    return { stage: null, hba1cLevel: null, weightLossKg: null };
  }

  const hba1cLevel = latest.blood_sugar_hba1c ? parseFloat(latest.blood_sugar_hba1c) : null;
  const firstWeight = first && first.weight ? parseFloat(first.weight) : null;
  const lastWeight = latest.weight ? parseFloat(latest.weight) : null;
  const weightLossKg = firstWeight && lastWeight ? parseFloat((firstWeight - lastWeight).toFixed(1)) : null;
  const stage = resolveStage(hba1cLevel);

  return { stage, hba1cLevel, weightLossKg };
};

// Determine reversal stage based on HbA1c level
const resolveStage = (hba1c) => {
  if (!hba1c) return null;
  if (hba1c < 5.7) return 'reversed';
  if (hba1c < 6.5) return 'improving';
  if (hba1c < 8.0) return 'stable';
  return 'started';
};

module.exports = { getSummary };
