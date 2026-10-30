const db = require('../config/db');
const { getRewardsSummary } = require('./rewards.service');

// ─── Patient Score + Rank ──────────────────────────────────────────────────────

const getPatientScore = async (patientId) => {
  // Get compliance for this patient
  const compliance = await getSevenDayCompliance(patientId);
  const overall = Math.round(
    compliance.dietPercent     * 0.30 +
    compliance.exercisePercent * 0.30 +
    compliance.medicinePercent * 0.40
  );

  // Get patient's branch
  const [[patientRow]] = await db.query(
    `SELECT branch_id FROM patients WHERE id = ? LIMIT 1`,
    [patientId]
  );
  const tier0 = overall >= 70 ? 'Gold' : overall >= 40 ? 'Silver' : 'Bronze';
  if (!patientRow) return { overall, rank: 1, totalPatients: 1, tier: tier0 };

  const branchId = patientRow.branch_id;

  // Rank computation in its own try-catch so overall always returns correctly
  try {
    // Get all active app patients in this branch (excluding current)
    const [branchPatients] = await db.query(
      `SELECT id FROM patients
       WHERE branch_id = ? AND status = 'active' AND id != ?
         AND (app_last_login IS NOT NULL OR app_password IS NOT NULL OR google_id IS NOT NULL OR apple_id IS NOT NULL)`,
      [branchId, patientId]
    );

    const totalPatients = branchPatients.length + 1; // +1 for current patient

    if (branchPatients.length === 0) return { overall, rank: 1, totalPatients, tier: tier0 };

    const ids = branchPatients.map(p => p.id);

    // Fetch compliance data for all branch patients in 3 flat queries (no correlated derived tables)
    const [medRows, exRows, dietRows] = await Promise.all([
      db.query(
        `SELECT app_user_id AS uid, COUNT(DISTINCT DATE(logged_at)) AS days
         FROM app_medicine_logs
         WHERE app_user_id IN (?) AND taken = 1
           AND logged_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY app_user_id`,
        [ids]
      ),
      db.query(
        `SELECT app_user_id AS uid, COUNT(DISTINCT DATE(created_at)) AS days
         FROM app_exercise_sessions
         WHERE app_user_id IN (?) AND compliance_status = 'completed'
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY app_user_id`,
        [ids]
      ),
      db.query(
        `SELECT patient_id AS uid, COUNT(*) AS days
         FROM (
           SELECT patient_id, DATE(logged_at) AS d
           FROM app_meal_logs
           WHERE patient_id IN (?) AND logged_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           GROUP BY patient_id, DATE(logged_at)
           HAVING COUNT(DISTINCT meal_period) >= 3
         ) t
         GROUP BY patient_id`,
        [ids]
      ),
    ]);

    const medMap  = Object.fromEntries(medRows[0].map(r  => [r.uid, Number(r.days)]));
    const exMap   = Object.fromEntries(exRows[0].map(r   => [r.uid, Number(r.days)]));
    const dietMap = Object.fromEntries(dietRows[0].map(r => [r.uid, Number(r.days)]));

    // Count how many branch patients have a higher score
    let ahead = 0;
    for (const p of branchPatients) {
      const pScore = Math.round(
        (medMap[p.id]  || 0) / 7.0 * 40 +
        (exMap[p.id]   || 0) / 7.0 * 30 +
        (dietMap[p.id] || 0) / 7.0 * 30
      );
      if (pScore > overall) ahead++;
    }

    const tier = overall >= 70 ? 'Gold' : overall >= 40 ? 'Silver' : 'Bronze';
    return { overall, rank: ahead + 1, totalPatients, tier };
  } catch (_) {
    return { overall, rank: 0, totalPatients: 0, tier: null };
  }
};

const getMonthlyProgress = async (patientId) => {
  if (!patientId) return [];
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const [medRows, exRows, dietRows, pointRows] = await Promise.all([
    db.query(
      `SELECT DATE_FORMAT(logged_at, '%Y-%m') AS month, COUNT(DISTINCT DATE(logged_at)) AS days
       FROM app_medicine_logs
       WHERE app_user_id = ? AND taken = 1
         AND logged_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month`,
      [patientId]
    ),
    db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(DISTINCT DATE(created_at)) AS days
       FROM app_exercise_sessions
       WHERE app_user_id = ? AND compliance_status = 'completed'
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month`,
      [patientId]
    ),
    db.query(
      `SELECT DATE_FORMAT(d, '%Y-%m') AS month, COUNT(*) AS days
       FROM (
         SELECT DATE(logged_at) AS d
         FROM app_meal_logs
         WHERE patient_id = ? AND logged_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY DATE(logged_at)
         HAVING COUNT(DISTINCT meal_period) >= 3
       ) t
       GROUP BY month`,
      [patientId]
    ),
    db.query(
      `SELECT DATE_FORMAT(earned_at, '%Y-%m') AS month, SUM(points) AS pts
       FROM app_reward_points
       WHERE app_user_id = ? AND earned_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month`,
      [patientId]
    ),
  ]);

  const daysInMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  };

  const medMap   = Object.fromEntries(medRows[0].map(r  => [r.month, Number(r.days)]));
  const exMap    = Object.fromEntries(exRows[0].map(r   => [r.month, Number(r.days)]));
  const dietMap  = Object.fromEntries(dietRows[0].map(r => [r.month, Number(r.days)]));
  const pointMap = Object.fromEntries(pointRows[0].map(r => [r.month, Number(r.pts)]));

  return months.map(month => {
    const days = daysInMonth(month);
    const score = Math.round(
      (medMap[month]  || 0) / days * 40 +
      (exMap[month]   || 0) / days * 30 +
      (dietMap[month] || 0) / days * 30
    );
    return {
      month,
      score,
      points: pointMap[month] != null ? pointMap[month] : null,
    };
  });
};

const getSummary = async (userId) => {
  const patientId = userId || null;

  const [appointments, vitals, compliance, rewards, vitalsToday, score, monthly] = await Promise.all([
    getAppointments(patientId),
    getLatestVitals(patientId),
    getSevenDayCompliance(patientId),
    patientId ? getRewardsSummary(patientId) : null,
    getTodayVitalsCount(patientId),
    patientId ? getPatientScore(patientId).catch(() => ({ overall: 0, rank: 0, totalPatients: 0, tier: null })) : { overall: 0, rank: 0, totalPatients: 0, tier: null },
    patientId ? getMonthlyProgress(patientId).catch(() => []) : [],
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
    score,
    monthly,
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

  const [dietRows, exerciseRows, medicineRows, stepsRows] = await Promise.all([
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
    // Steps: average daily steps over last 7 days
    db.query(
      `SELECT AVG(daily_steps) AS avg FROM (
         SELECT MAX(steps) AS daily_steps
         FROM app_steps_log
         WHERE app_user_id = ? AND type = 'steps'
           AND COALESCE(date, DATE(logged_at)) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY COALESCE(date, DATE(logged_at))
       ) t`,
      [patientId, DAYS]
    ),
  ]);

  const dietDays     = Number(dietRows[0][0]?.compliant_days     || 0);
  const exerciseDays = Number(exerciseRows[0][0]?.compliant_days || 0);
  const medicineDays = Number(medicineRows[0][0]?.compliant_days || 0);
  const stepsAvgPerDay = Math.round(stepsRows[0][0]?.avg || 0);

  return {
    dietPercent:     Math.round((dietDays     / DAYS) * 100),
    exercisePercent: Math.round((exerciseDays / DAYS) * 100),
    medicinePercent: Math.round((medicineDays / DAYS) * 100),
    sleepAvgHours:   0,
    stepsAvgPerDay,
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
