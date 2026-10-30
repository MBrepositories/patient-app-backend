const db = require('../config/db');

const CALORIES_PER_STEP   = 0.04;   // kcal per step (approximate)
const DISTANCE_PER_STEP   = 0.0008; // km per step (average 80 cm stride)
const WALKING_PACE_MIN_KM = 12;     // min/km default pace

// Default step goals per careplan (plan_id)
const DEFAULT_STEP_GOALS = {
  1: { stepGoal: 10000, walkingTarget: 5000 }, // Diabetes
  2: { stepGoal: 8000,  walkingTarget: 4000 }, // Heart
  3: { stepGoal: 9000,  walkingTarget: 4500 }, // Hypertension
  4: { stepGoal: 12000, walkingTarget: 6000 }, // Obesity
  5: { stepGoal: 6000,  walkingTarget: 3000 }, // Knee
  6: { stepGoal: 8000,  walkingTarget: 4000 }, // Manoswasthya
};

const FALLBACK_STEP_GOAL    = 10000;
const FALLBACK_WALKING_TARGET = 5000;

// Get patient's step goal — doctor override first, then careplan default
const getPatientGoals = async (patientId) => {
  const [[careplan]] = await db.query(
    `SELECT plan_id, step_goal, walking_target
     FROM app_patient_careplans
     WHERE app_user_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [patientId]
  );

  if (!careplan) {
    return { stepGoal: FALLBACK_STEP_GOAL, walkingTarget: FALLBACK_WALKING_TARGET };
  }

  const defaults = DEFAULT_STEP_GOALS[careplan.plan_id] || { stepGoal: FALLBACK_STEP_GOAL, walkingTarget: FALLBACK_WALKING_TARGET };

  return {
    stepGoal:      careplan.step_goal      || defaults.stepGoal,
    walkingTarget: careplan.walking_target || defaults.walkingTarget,
  };
};

// ─── STEPS ───────────────────────────────────────────────────────────────────

const getStepsDetail = async (patientId) => {
  const today = new Date().toISOString().slice(0, 10);

  const [{ stepGoal }] = await Promise.all([getPatientGoals(patientId)]);

  // Today's steps — prefer date column (new), fallback to logged_at (old)
  const [[latestToday]] = await db.query(
    `SELECT MAX(steps) AS steps FROM app_steps_log
     WHERE app_user_id = ? AND type = 'steps'
       AND COALESCE(date, DATE(logged_at)) = ?`,
    [patientId, today]
  );
  const todaySteps = latestToday?.steps || 0;

  // Hourly breakdown today
  const [hourlyRows] = await db.query(
    `SELECT HOUR(logged_at) AS hour, MAX(steps) AS steps
     FROM app_steps_log
     WHERE app_user_id = ? AND type = 'steps' AND DATE(logged_at) = ?
     GROUP BY HOUR(logged_at)
     ORDER BY hour ASC`,
    [patientId, today]
  );

  // Build full 24-hour array, each hour = delta from previous hour
  const hourMap = {};
  hourlyRows.forEach(r => { hourMap[r.hour] = r.steps; });

  const hourlyBreakdown = [];
  let prev = 0;
  for (let h = 0; h < 24; h++) {
    const cumulative = hourMap[h] !== undefined ? hourMap[h] : prev;
    hourlyBreakdown.push({ hour: h, steps: Math.max(0, cumulative - prev) });
    if (hourMap[h] !== undefined) prev = hourMap[h];
  }

  // Weekly history — last 7 days, prefer date column (new), fallback to logged_at (old)
  const [weeklyRows] = await db.query(
    `SELECT DATE_FORMAT(COALESCE(date, DATE(logged_at)), '%Y-%m-%d') AS date, MAX(steps) AS steps
     FROM app_steps_log
     WHERE app_user_id = ? AND type = 'steps'
       AND COALESCE(date, DATE(logged_at)) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY COALESCE(date, DATE(logged_at))
     ORDER BY date ASC`,
    [patientId]
  );

  const weeklyHistory = weeklyRows.map(r => ({
    date:    r.date,
    steps:   r.steps,
    goalMet: r.steps >= stepGoal,
  }));

  return {
    todaySteps,
    goalSteps:      stepGoal,
    caloriesBurned: parseFloat((todaySteps * CALORIES_PER_STEP).toFixed(1)),
    distanceKm:     parseFloat((todaySteps * DISTANCE_PER_STEP).toFixed(2)),
    activeMinutes:  Math.floor(todaySteps / 100),
    hourlyBreakdown,
    weeklyHistory,
  };
};

const syncSteps = async (patientId, steps, date) => {
  if (date) {
    // New: upsert by date, never lower the saved count
    await db.query(
      `INSERT INTO app_steps_log (app_user_id, type, date, steps)
       VALUES (?, 'steps', ?, ?)
       ON DUPLICATE KEY UPDATE steps = GREATEST(steps, VALUES(steps))`,
      [patientId, date, steps]
    );
  } else {
    // Old behavior — keep for backward compatibility
    await db.query(
      `INSERT INTO app_steps_log (app_user_id, type, steps) VALUES (?, 'steps', ?)`,
      [patientId, steps]
    );
  }
};

const syncStepsHistory = async (patientId, { days = [] }) => {
  for (const d of days) {
    await db.query(
      `INSERT INTO app_steps_log (app_user_id, type, date, steps)
       VALUES (?, 'steps', ?, ?)
       ON DUPLICATE KEY UPDATE steps = GREATEST(steps, VALUES(steps))`,
      [patientId, d.date, d.steps]
    );
  }
};

// ─── WALKING ─────────────────────────────────────────────────────────────────

const getWalkingDetail = async (patientId) => {
  const today = new Date().toISOString().slice(0, 10);

  const { walkingTarget } = await getPatientGoals(patientId);

  const [[latestToday]] = await db.query(
    `SELECT steps FROM app_steps_log
     WHERE app_user_id = ? AND type = 'walking' AND DATE(logged_at) = ?
     ORDER BY logged_at DESC LIMIT 1`,
    [patientId, today]
  );
  const steps = latestToday ? latestToday.steps : 0;

  const distanceKm         = parseFloat((steps * DISTANCE_PER_STEP).toFixed(2));
  const walkingTimeMinutes  = Math.round(distanceKm * WALKING_PACE_MIN_KM);
  const paceMinPerKm        = distanceKm > 0 ? parseFloat((walkingTimeMinutes / distanceKm).toFixed(1)) : 0;
  const caloriesBurned      = parseFloat((steps * CALORIES_PER_STEP).toFixed(1));
  const compliancePercent   = Math.min(100, Math.round((steps / walkingTarget) * 100));

  return {
    steps,
    targetSteps: walkingTarget,
    distanceKm,
    walkingTimeMinutes,
    paceMinPerKm,
    caloriesBurned,
    compliancePercent,
  };
};

const syncWalking = async (patientId, steps) => {
  await db.query(
    `INSERT INTO app_steps_log (app_user_id, type, steps) VALUES (?, 'walking', ?)`,
    [patientId, steps]
  );
};

module.exports = { getStepsDetail, syncSteps, syncStepsHistory, getWalkingDetail, syncWalking };
