const db = require('../config/db');
const { getRewardsSummary } = require('./rewards.service');

const getSummary = async (userId) => {
  const patientId = userId || null;

  const [appointments, vitals, compliance, rewards, vitalsToday] = await Promise.all([
    getAppointments(patientId),
    getLatestVitals(patientId),
    getSevenDayCompliance(patientId),
    patientId ? getRewardsSummary(patientId) : null,
    getTodayVitalsCount(patientId),
  ]);

  const streakDays = rewards ? getStreakDays(rewards) : 0;

  return {
    streak: { days: streakDays },
    goals: { completed: 0, target: 0, completionMessage: '' },
    vitals: { logged: vitalsToday, target: 4 },
    steps: { count: 0 },
    points: { total: rewards ? rewards.totalPoints : 0 },
    compliance,
    reversalJourney: vitals,
    appointments,
  };
};

const getTodayVitalsCount = async (patientId) => {
  if (!patientId) return 0;
  const [[row]] = await db.query(
    `SELECT COUNT(DISTINCT type) AS cnt FROM app_vitals
     WHERE app_user_id = ? AND DATE(logged_at) = CURDATE()`,
    [patientId]
  );
  return Number(row?.cnt || 0);
};

const getSevenDayCompliance = async (patientId) => {
  if (!patientId) {
    return { dietPercent: 0, exercisePercent: 0, medicinePercent: 0, sleepAvgHours: 0, stepsAvgPerDay: 0 };
  }

  const DAYS = 7;
  const MEALS_TARGET = 3;

  const [dietRows, exerciseRows, medicineRows] = await Promise.all([
    // Diet: count distinct days where patient logged >= 3 meal periods
    db.query(
      `SELECT COUNT(*) AS compliant_days FROM (
         SELECT DATE(logged_at) AS log_date
         FROM app_meal_logs
         WHERE patient_id = ? AND logged_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(logged_at)
         HAVING COUNT(DISTINCT meal_period) >= ?
       ) t`,
      [patientId, DAYS, MEALS_TARGET]
    ),
    // Exercise: count distinct days with at least 1 completed session
    db.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) AS compliant_days
       FROM app_exercise_sessions
       WHERE app_user_id = ? AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND compliance_status = 'completed'`,
      [patientId, DAYS]
    ),
    // Medicine: count distinct days with at least 1 medicine logged
    db.query(
      `SELECT COUNT(DISTINCT DATE(logged_at)) AS compliant_days
       FROM app_medicine_logs
       WHERE app_user_id = ? AND logged_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND taken = 1`,
      [patientId, DAYS]
    ),
  ]);

  const dietDays     = Number(dietRows[0][0]?.compliant_days     || 0);
  const exerciseDays = Number(exerciseRows[0][0]?.compliant_days || 0);
  const medicineDays = Number(medicineRows[0][0]?.compliant_days || 0);

  return {
    dietPercent:     Math.round((dietDays     / DAYS) * 100),
    exercisePercent: Math.round((exerciseDays / DAYS) * 100),
    medicinePercent: Math.round((medicineDays / DAYS) * 100),
    sleepAvgHours:   0,
    stepsAvgPerDay:  0,
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

// Extract consecutive streak days from rewards milestones
const getStreakDays = (rewards) => {
  const streak = rewards.milestones?.find(m => m.kind === 'streak');
  if (!streak) return 0;
  if (streak.completed) return 7;
  const match = String(streak.subtitle || '').match(/^(\d+)\/7/);
  return match ? parseInt(match[1]) : 0;
};

module.exports = { getSummary };
