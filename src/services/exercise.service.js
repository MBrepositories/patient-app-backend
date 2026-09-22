const db = require('../config/db');

const PLAN_KEY_MAP = {
  1: 'diabetes',
  2: 'heart',
  3: 'hypertension',
  4: 'obesity',
  5: 'knee',
  6: 'manoswasthya',
};

// ─── Care Plans ───────────────────────────────────────────────────────────────

const getCarePlans = () => [
  { planId: 1, name: 'Diabetes Care Plan' },
  { planId: 2, name: 'Heart Care Plan' },
  { planId: 3, name: 'Hypertension Care Plan' },
  { planId: 4, name: 'Obesity Management Program' },
  { planId: 5, name: 'Knee Care Plan' },
  { planId: 6, name: 'Manoswasthya - Guided Meditation' },
];

// ─── Today's Program ──────────────────────────────────────────────────────────

const getTodayProgram = async (patientId, queryPlanId) => {
  let planId = queryPlanId ? parseInt(queryPlanId) : null;
  let startDate = null;
  let totalDays = 90;

  if (!planId) {
    // No planId passed — look up active enrollment
    const [enrollments] = await db.query(
      'SELECT plan_id, start_date, total_days FROM app_patient_careplans WHERE app_user_id = ? AND status = "active" LIMIT 1',
      [patientId]
    );
    if (!enrollments.length) {
      const err = new Error('Not enrolled in any care plan.'); err.statusCode = 404; throw err;
    }
    planId = enrollments[0].plan_id;
    startDate = enrollments[0].start_date;
    totalDays = enrollments[0].total_days;
  } else {
    // planId passed — check if enrolled to get start_date (optional, won't fail if not enrolled)
    const [enrollments] = await db.query(
      'SELECT start_date, total_days FROM app_patient_careplans WHERE app_user_id = ? AND plan_id = ? AND status = "active" LIMIT 1',
      [patientId, planId]
    );
    if (enrollments.length) {
      startDate = enrollments[0].start_date;
      totalDays = enrollments[0].total_days;
    }
  }

  // Calculate current day number
  let currentDayNumber = 1;
  if (startDate) {
    const daysDiff = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    currentDayNumber = Math.min(Math.max(daysDiff + 1, 1), totalDays);
  }

  const planKey = PLAN_KEY_MAP[planId];
  const isManoswasthya = planId === 6;

  // Fetch exercises and sessions in parallel
  const queries = [
    db.query('SELECT * FROM app_exercise_programs WHERE plan_id = ? ORDER BY day_number', [planId]),
    db.query(
      `SELECT exercise_id, exercise_score, posture_score, accuracy_score, pace_score,
              compliance_status, DATE(created_at) AS session_date
       FROM app_exercise_sessions WHERE app_user_id = ? ORDER BY created_at DESC`,
      [patientId]
    ),
  ];

  // Always include Manoswasthya as second daily item (unless patient IS on Manoswasthya plan)
  if (!isManoswasthya) {
    queries.push(db.query('SELECT * FROM app_exercise_programs WHERE plan_id = 6 ORDER BY day_number'));
  }

  const results = await Promise.all(queries);
  const [mainExercises] = results[0];
  const [sessions] = results[1];
  const meditationExercises = !isManoswasthya ? results[2][0] : [];

  // Map latest session per exercise_id
  const sessionMap = {};
  sessions.forEach(s => {
    if (!sessionMap[s.exercise_id]) sessionMap[s.exercise_id] = s;
  });

  // Group exercises by day
  const mainByDay = groupByDay(mainExercises);
  const meditByDay = groupByDay(meditationExercises);

  // Build 7-day streak (Mon–Sun current week)
  const weekStreak = buildWeekStreak(sessions);

  // Build all days
  const days = [];
  for (let day = 1; day <= totalDays; day++) {
    const items = [...(mainByDay[day] || []), ...(meditByDay[day] || [])];
    const protocolItems = items.map(e => formatProtocolItem(e, sessionMap));
    const isCompleted = protocolItems.length > 0 && protocolItems.every(i => i.isCompleted);
    days.push({ day, isCompleted, protocolItems });
  }

  return {
    totalDays,
    currentDayNumber,
    days,
    streak: { week: weekStreak },
    activity: {
      steps: 0,
      dailyGoalSteps: 10000,
      distanceKm: 0,
      calories: 0,
    },
  };
};

const groupByDay = (exercises) => {
  const map = {};
  exercises.forEach(e => {
    if (!map[e.day_number]) map[e.day_number] = [];
    map[e.day_number].push(e);
  });
  return map;
};

const formatProtocolItem = (e, sessionMap) => {
  const exerciseId = `${e.plan_key}-day-${e.day_number}`;
  const session = sessionMap[exerciseId];
  const durationMinutes = e.plan_category === 'meditation'
    ? 15
    : Math.max(10, Math.ceil(((e.target_sets || 1) * (e.target_reps || 10) * 4) / 60));

  // Parse equipment JSON safely
  let equipment = [];
  if (e.equipment) {
    try { equipment = typeof e.equipment === 'string' ? JSON.parse(e.equipment) : e.equipment; } catch (_) {}
  }

  return {
    id: exerciseId,
    type: e.plan_category === 'meditation' ? 'meditation' : 'exercise',
    title: e.exercise_title,
    subtitle: e.plan_name,
    durationMinutes,
    videoUrl: e.video_url || null,
    thumbnailUrl: e.thumbnail_url || null,
    requiresCamera: e.requires_camera === 1,
    exerciseKey: e.exercise_key || null,
    calories: e.calories || null,
    difficultyLabel: e.difficulty_label || null,
    equipment,
    targetReps: e.target_reps || null,
    targetSets: e.target_sets || null,
    targetHoldSeconds: e.target_hold_seconds || null,
    isRequired: true,
    isCompleted: !!session,
    previousScore: session ? session.exercise_score : null,
    previousPostureScore: session ? session.posture_score : null,
    previousAccuracyScore: session ? session.accuracy_score : null,
    previousPaceScore: session ? session.pace_score : null,
  };
};

const buildWeekStreak = (sessions) => {
  // Get Monday of current week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  // Build set of session dates this week
  const completedDates = new Set(
    sessions
      .filter(s => s.compliance_status === 'completed' || s.compliance_status === 'partial')
      .map(s => (s.session_date instanceof Date
        ? s.session_date.toISOString().split('T')[0]
        : String(s.session_date).split('T')[0]
      ))
  );

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = day.toISOString().split('T')[0];
    return completedDates.has(dateStr);
  });
};

// ─── Complete Camera Session ──────────────────────────────────────────────────

const completeCameraSession = async (patientId, data) => {
  const {
    exerciseId, exerciseKey, durationSeconds, reps, targetReps,
    postureScore, accuracyScore, paceScore, exerciseScore,
    caloriesBurned, complianceStatus, timestamp,
  } = data;

  // Derive plan_id from exerciseId prefix (e.g. "diabetes-day-12" → planId 1)
  const planKeyReverse = Object.entries(PLAN_KEY_MAP).find(([, key]) => exerciseId.startsWith(key));
  const planId = planKeyReverse ? parseInt(planKeyReverse[0]) : null;

  const sessionDate = timestamp
    ? new Date(timestamp).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  await db.query(
    `INSERT INTO app_exercise_sessions
       (app_user_id, plan_id, exercise_id, exercise_key, duration_seconds, reps, target_reps,
        posture_score, accuracy_score, pace_score, exercise_score, calories_burned,
        compliance_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      patientId, planId, exerciseId, exerciseKey || null, durationSeconds || null,
      reps || null, targetReps || null, postureScore || null, accuracyScore || null,
      paceScore || null, exerciseScore || null, caloriesBurned || null,
      complianceStatus,
    ]
  );
};

// ─── 7-Day Compliance ─────────────────────────────────────────────────────────

const getCompliance = async (patientId) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const fromDate = sevenDaysAgo.toISOString().split('T')[0];

  const [sessions] = await db.query(
    `SELECT s.*, DATE(s.created_at) AS session_date, p.exercise_title, p.plan_name, p.target_reps
     FROM app_exercise_sessions s
     LEFT JOIN app_exercise_programs p ON p.plan_key = SUBSTRING_INDEX(s.exercise_id, '-day-', 1)
       AND p.day_number = CAST(SUBSTRING_INDEX(s.exercise_id, '-day-', -1) AS UNSIGNED)
     WHERE s.app_user_id = ? AND DATE(s.created_at) >= ?
     ORDER BY s.created_at DESC`,
    [patientId, fromDate]
  );

  const sessionsTarget = 7;
  const sessionsCompleted = sessions.filter(s => s.compliance_status === 'completed' || s.compliance_status === 'partial').length;
  const targetMetPercent = Math.round((sessionsCompleted / sessionsTarget) * 100);

  const avgDurationMinutes = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length / 60)
    : 0;

  const remaining = sessionsTarget - sessionsCompleted;
  const coachInsight = remaining > 0
    ? `You're ${remaining} session${remaining > 1 ? 's' : ''} away from your weekly goal. Keep it up!`
    : 'Great job! You\'ve hit your weekly exercise goal.';

  const activityLog = sessions.map(s => ({
    id: `log-${s.id}`,
    exerciseId: s.exercise_id,
    title: s.exercise_title || s.exercise_id,
    subtitle: formatSessionSubtitle(s),
    status: s.compliance_status === 'missed' ? 'missed' : 'completed',
    exerciseScore: s.exercise_score || null,
    repsCompleted: s.reps || null,
    targetReps: s.target_reps || null,
  }));

  return {
    targetMetPercent,
    sessionsCompleted,
    sessionsTarget,
    avgHeartRate: null,
    avgDurationMinutes,
    coachInsight,
    historyRangeLabel: '7-Day History',
    activityLog,
  };
};

const formatSessionSubtitle = (s) => {
  if (!s.session_date) return 'No Activity';
  const date = new Date(s.session_date);
  const dateLabel = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  return s.compliance_status === 'missed'
    ? `${dateLabel} • No Activity`
    : `${dateLabel}`;
};

// ─── Wellness History ─────────────────────────────────────────────────────────

const getWellnessHistory = async (patientId) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // First and last day of current month
  const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
  const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const [sessions] = await db.query(
    `SELECT s.*, DATE(s.created_at) AS session_date, p.exercise_title, p.plan_category, p.plan_name
     FROM app_exercise_sessions s
     LEFT JOIN app_exercise_programs p ON p.plan_key = SUBSTRING_INDEX(s.exercise_id, '-day-', 1)
       AND p.day_number = CAST(SUBSTRING_INDEX(s.exercise_id, '-day-', -1) AS UNSIGNED)
     WHERE s.app_user_id = ? AND DATE(s.created_at) BETWEEN ? AND ?
     ORDER BY s.created_at DESC`,
    [patientId, firstDay, lastDay]
  );

  // Build completed date set for calendar
  const completedDates = new Set(
    sessions
      .filter(s => s.compliance_status !== 'missed')
      .map(s => String(s.session_date).split('T')[0])
  );

  // Weekly progress — all days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const weeklyProgress = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const date = new Date(year, month, d);
    const dateStr = date.toISOString().split('T')[0];
    const dayLabel = date.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
    let status = 'none';
    if (d < today) status = completedDates.has(dateStr) ? 'completed' : 'none';
    else if (d === today) status = completedDates.has(dateStr) ? 'completed' : 'logged';
    return { date: d, dayLabel, status, isToday: d === today };
  });

  // Exercise stats
  const exerciseSessions = sessions.filter(s => s.plan_category !== 'meditation');
  const meditationSessions = sessions.filter(s => s.plan_category === 'meditation');

  const totalExerciseDuration = exerciseSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const totalCalories = exerciseSessions.reduce((sum, s) => sum + (s.calories_burned || 0), 0);
  const totalMeditationDuration = meditationSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  // Recent activities (last 10)
  const recentActivities = sessions.slice(0, 10).map(s => ({
    id: s.exercise_id,
    title: s.exercise_title || s.exercise_id,
    dateLabel: formatActivityDate(s.session_date),
    durationMinutes: s.duration_seconds ? Math.round(s.duration_seconds / 60) : null,
    intensity: s.plan_category === 'meditation' ? 'mental' : (s.exercise_score >= 80 ? 'high' : 'low'),
    intensityLabel: s.plan_category === 'meditation' ? 'Meditation' : (s.exercise_score >= 80 ? 'High Intensity' : 'Low Intensity'),
  }));

  return {
    monthLabel,
    weeklyProgress,
    exerciseStats: {
      primaryLabel: 'Total Duration',
      primaryValue: `${Math.round(totalExerciseDuration / 60)} min`,
      secondaryLabel: 'Calories Burned',
      secondaryValue: `${totalCalories.toLocaleString('en-IN')} kcal`,
    },
    meditationStats: {
      primaryLabel: 'Total Sessions',
      primaryValue: `${meditationSessions.length} completed`,
      secondaryLabel: 'Mindful Minutes',
      secondaryValue: `${Math.round(totalMeditationDuration / 60)} min`,
    },
    recentActivities,
  };
};

const formatActivityDate = (sessionDate) => {
  if (!sessionDate) return '';
  const date = new Date(sessionDate);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

module.exports = { getCarePlans, getTodayProgram, completeCameraSession, getCompliance, getWellnessHistory };
