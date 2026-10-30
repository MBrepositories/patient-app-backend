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
  { planId: 1, name: 'Diabetes Care Plan',           alignedVital: 'hba1c' },
  { planId: 2, name: 'Heart Care Plan',               alignedVital: 'ldl' },
  { planId: 3, name: 'Hypertension Care Plan',        alignedVital: 'bloodPressure' },
  { planId: 4, name: 'Obesity Management Program',    alignedVital: 'weight' },
  { planId: 5, name: 'Knee Care Plan',                alignedVital: 'weight' },
  { planId: 6, name: 'Manoswasthya - Guided Meditation', alignedVital: null },
];

// ─── Today's Program ──────────────────────────────────────────────────────────

const formatDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
};

// Day 1 = day after enrolment
const enrollmentToStartDate = (d) => {
  if (!d) return null;
  const date = d instanceof Date ? new Date(d) : new Date(String(d).slice(0, 10));
  date.setDate(date.getDate() + 1);
  return formatDate(date);
};

const sessionDateStr = (d) =>
  d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];

// Calendar-gated currentDayNumber:
// A day only "advances" if ALL its items are completed on a PREVIOUS calendar day.
// Completes Day 5 today → stays 5 today, becomes 6 tomorrow.
const computeCurrentDay = (byDay, sessionMap, totalD, today) => {
  let current = 1;
  for (let day = 1; day <= totalD; day++) {
    const items = byDay[day] || [];
    if (items.length === 0) continue;
    const allDoneBeforeToday = items.every(e => {
      const session = sessionMap[`${e.plan_key}-day-${e.day_number}`];
      if (!session) return false;
      return sessionDateStr(session.session_date) < today;
    });
    if (allDoneBeforeToday) {
      current = day + 1;
    } else {
      break;
    }
  }
  return Math.min(current, totalD);
};

const getTodayProgram = async (patientId, queryPlanId) => {
  const today = new Date().toISOString().split('T')[0];

  // 1. Get exercise enrollment (plan_id 1-5)
  const [[exerciseEnrollment]] = await db.query(
    `SELECT apc.plan_id, apc.start_date, apc.total_days, cm.care_plan_name
     FROM app_patient_careplans apc
     LEFT JOIN careplan_master cm ON cm.id = apc.plan_id
     WHERE apc.app_user_id = ? AND apc.status = 'active' AND apc.plan_id != 6
     ORDER BY apc.created_at DESC LIMIT 1`,
    [patientId]
  );

  // 2. Get meditation enrollment (plan_id 6)
  const [[meditationEnrollment]] = await db.query(
    `SELECT apc.plan_id, apc.start_date, apc.total_days, cm.care_plan_name
     FROM app_patient_careplans apc
     LEFT JOIN careplan_master cm ON cm.id = apc.plan_id
     WHERE apc.app_user_id = ? AND apc.status = 'active' AND apc.plan_id = 6
     ORDER BY apc.created_at DESC LIMIT 1`,
    [patientId]
  );

  // 3. 404 only if NEITHER exercise nor meditation enrolled
  if (!exerciseEnrollment && !meditationEnrollment) {
    const err = new Error('Not enrolled in any care plan.'); err.statusCode = 404; throw err;
  }

  const exerciseAssigned = !!exerciseEnrollment;
  const meditAssigned    = !!meditationEnrollment;

  const totalDays      = exerciseAssigned ? (exerciseEnrollment.total_days || 90) : (meditationEnrollment.total_days || 90);
  const meditTotalDays = meditAssigned ? (meditationEnrollment.total_days || 90) : 90;
  const planId         = queryPlanId ? parseInt(queryPlanId) : (exerciseAssigned ? exerciseEnrollment.plan_id : 6);

  // 4. Fetch exercises and sessions
  const fetchQueries = [
    db.query(
      `SELECT exercise_id, exercise_score, posture_score, accuracy_score, pace_score,
              compliance_status, DATE(created_at) AS session_date
       FROM app_exercise_sessions WHERE app_user_id = ? ORDER BY created_at DESC`,
      [patientId]
    ),
  ];
  if (exerciseAssigned) fetchQueries.push(db.query('SELECT * FROM app_exercise_programs WHERE plan_id = ? ORDER BY day_number', [planId]));
  if (meditAssigned)    fetchQueries.push(db.query('SELECT * FROM app_exercise_programs WHERE plan_id = 6 ORDER BY day_number'));

  const fetchResults  = await Promise.all(fetchQueries);
  const [sessions]    = fetchResults[0];
  const mainExercises = exerciseAssigned ? fetchResults[1][0] : [];
  const meditExercises = meditAssigned ? fetchResults[exerciseAssigned ? 2 : 1][0] : [];

  // 5. Map sessions
  const sessionMap = {};
  sessions.forEach(s => { if (!sessionMap[s.exercise_id]) sessionMap[s.exercise_id] = s; });

  // 6. Group by day
  const mainByDay  = groupByDay(mainExercises);
  const meditByDay = groupByDay(meditExercises);

  // 7. Build week streak
  const weekStreak = buildWeekStreak(sessions);

  // 8. Build all days
  const days = [];
  for (let day = 1; day <= totalDays; day++) {
    const items = [...(mainByDay[day] || []), ...(meditByDay[day] || [])];
    const protocolItems = items.map(e => formatProtocolItem(e, sessionMap));
    const isCompleted = protocolItems.length > 0 && protocolItems.every(i => i.isCompleted);
    days.push({ day, isCompleted, protocolItems });
  }

  // 9. Calendar-gated currentDayNumber per track
  const exerciseCurrentDay = exerciseAssigned
    ? computeCurrentDay(mainByDay, sessionMap, totalDays, today)
    : 1;
  const meditCurrentDay = meditAssigned
    ? computeCurrentDay(meditByDay, sessionMap, meditTotalDays, today)
    : 1;

  // 10. Build tracks
  const tracks = {
    exercise: {
      assigned:         exerciseAssigned,
      planName:         exerciseAssigned ? (exerciseEnrollment.care_plan_name || null) : null,
      currentDayNumber: exerciseAssigned ? exerciseCurrentDay : 1,
      totalDays:        exerciseAssigned ? totalDays : 90,
      startDate:        exerciseAssigned ? enrollmentToStartDate(exerciseEnrollment.start_date) : null,
    },
    meditation: {
      assigned:         meditAssigned,
      planName:         meditAssigned ? (meditationEnrollment.care_plan_name || null) : null,
      currentDayNumber: meditAssigned ? meditCurrentDay : 1,
      totalDays:        meditAssigned ? meditTotalDays : 90,
      startDate:        meditAssigned ? enrollmentToStartDate(meditationEnrollment.start_date) : null,
    },
  };

  const overallCurrentDay = exerciseAssigned ? exerciseCurrentDay : meditCurrentDay;

  return {
    totalDays,
    currentDayNumber: overallCurrentDay,
    tracks,
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

  // Last 7 days (today - 6 days to today) — use local date to avoid UTC shift
  const pad = n => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const rangeStartStr = `${rangeStart.getFullYear()}-${pad(rangeStart.getMonth() + 1)}-${pad(rangeStart.getDate())}`;

  // Fetch sessions for last 7 days + full month (for stats/recent activities)
  const firstDay = `${year}-${pad(month + 1)}-01`;
  const lastDayDate = new Date(year, month + 1, 0);
  const lastDay  = `${lastDayDate.getFullYear()}-${pad(lastDayDate.getMonth() + 1)}-${pad(lastDayDate.getDate())}`;
  const queryStart = rangeStartStr < firstDay ? rangeStartStr : firstDay;
  const queryEnd   = lastDay;

  const [sessions] = await db.query(
    `SELECT s.*, DATE(s.created_at) AS session_date, p.exercise_title, p.plan_category, p.plan_name
     FROM app_exercise_sessions s
     LEFT JOIN app_exercise_programs p ON p.plan_key = SUBSTRING_INDEX(s.exercise_id, '-day-', 1)
       AND p.day_number = CAST(SUBSTRING_INDEX(s.exercise_id, '-day-', -1) AS UNSIGNED)
     WHERE s.app_user_id = ? AND DATE(s.created_at) BETWEEN ? AND ?
     ORDER BY s.created_at DESC`,
    [patientId, queryStart, queryEnd]
  );

  // Build completed date set
  const completedDates = new Set(
    sessions
      .filter(s => s.compliance_status !== 'missed')
      .map(s => String(s.session_date).split('T')[0])
  );

  // Weekly progress — last 7 days (today - 6 to today)
  const weeklyProgress = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(rangeStart);
    date.setDate(rangeStart.getDate() + i);
    const dateStr  = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const dayLabel = date.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();
    const isPast   = dateStr < todayStr;
    const isToday  = dateStr === todayStr;
    let status = 'none';
    if (isPast || isToday) status = completedDates.has(dateStr) ? 'completed' : (isToday ? 'logged' : 'none');
    return { date: date.getDate(), dayLabel, status, isToday };
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
