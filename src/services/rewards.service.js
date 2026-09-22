const db = require('../config/db');

// ─── Points config per activity ───────────────────────────────────────────────
const ACTIVITY_CONFIG = [
  { id: 'log-vitals',     points: 5,  iconName: 'monitor-heart', iconColor: '#E63950', iconBackground: '#E639501A', title: 'Log Vitals',     subtitle: 'Sync your blood pressure or glucose levels daily.' },
  { id: 'exercise',       points: 10, iconName: 'fitness-center', iconColor: '#4C6FFF', iconBackground: '#4C6FFF1A', title: 'Complete Exercise', subtitle: 'Complete your daily exercise program.' },
  { id: 'log-meals',      points: 5,  iconName: 'restaurant',     iconColor: '#F2994A', iconBackground: '#F2994A1A', title: 'Log Meals',      subtitle: 'Log your meals every day to stay on track.' },
  { id: 'survey',         points: 15, iconName: 'assignment',     iconColor: '#27AE60', iconBackground: '#27AE601A', title: 'Weekly Survey',   subtitle: 'Submit your weekly health survey.' },
  { id: 'steps-goal',     points: 5,  iconName: 'directions-walk', iconColor: '#F2994A', iconBackground: '#F2994A1A', title: 'Steps Goal Met',  subtitle: 'Hit your daily step goal.' },
  { id: 'medicine-taken', points: 2,  iconName: 'medication',     iconColor: '#9B51E0', iconBackground: '#9B51E01A', title: 'Medicine Taken',  subtitle: 'Mark your daily doses as taken.' },
];

// ─── Tier based on total points ───────────────────────────────────────────────
const getTier = (total) => {
  if (total >= 5000) return 'Platinum';
  if (total >= 2500) return 'Gold';
  if (total >= 1000) return 'Silver';
  return 'Bronze';
};

// ─── Award points (called from other services) ────────────────────────────────
const awardPoints = async (patientId, activity, note = null) => {
  const cfg = ACTIVITY_CONFIG.find(a => a.id === activity);
  if (!cfg) return;

  // Prevent duplicate points for same activity on same day (except medicine-taken)
  if (activity !== 'medicine-taken') {
    const today = new Date().toISOString().slice(0, 10);
    const [[existing]] = await db.query(
      `SELECT id FROM app_reward_points
       WHERE app_user_id = ? AND activity = ? AND DATE(earned_at) = ?`,
      [patientId, activity, today]
    );
    if (existing) return; // Already awarded today
  }

  await db.query(
    `INSERT INTO app_reward_points (app_user_id, activity, points, note) VALUES (?, ?, ?, ?)`,
    [patientId, activity, cfg.points, note]
  );
};

// ─── Rewards Summary ──────────────────────────────────────────────────────────
const getRewardsSummary = async (patientId) => {
  // Total points and redeemed
  const [[totals]] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) AS totalEarned,
       COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0) AS totalRedeemed
     FROM app_reward_points WHERE app_user_id = ?`,
    [patientId]
  );

  const totalEarned   = totals.totalEarned;
  const totalRedeemed = totals.totalRedeemed;
  const totalPoints   = totalEarned - totalRedeemed;

  // Points this week
  const [[weekTotals]] = await db.query(
    `SELECT COALESCE(SUM(points), 0) AS weekPoints
     FROM app_reward_points
     WHERE app_user_id = ? AND points > 0
       AND earned_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [patientId]
  );

  // Monthly goal — target 4000 pts
  const MONTHLY_TARGET = 4000;
  const [[monthTotals]] = await db.query(
    `SELECT COALESCE(SUM(points), 0) AS monthPoints
     FROM app_reward_points
     WHERE app_user_id = ? AND points > 0
       AND MONTH(earned_at) = MONTH(NOW()) AND YEAR(earned_at) = YEAR(NOW())`,
    [patientId]
  );
  const monthPoints   = monthTotals.monthPoints;
  const monthPercent  = Math.min(100, Math.round((monthPoints / MONTHLY_TARGET) * 100));
  const monthStatus   = monthPercent >= 75 ? 'On track' : monthPercent >= 50 ? 'Halfway there' : 'Keep going';

  // Streak — check last 7 consecutive days with any activity
  const [streakRows] = await db.query(
    `SELECT DISTINCT DATE(earned_at) AS active_date
     FROM app_reward_points
     WHERE app_user_id = ? AND points > 0
       AND earned_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY active_date DESC`,
    [patientId]
  );
  const streakCompleted = streakRows.length >= 7;

  const milestones = [
    {
      kind:          'goal',
      title:         'Monthly Goal',
      currentPoints: monthPoints,
      targetPoints:  MONTHLY_TARGET,
      percent:       monthPercent,
      statusLabel:   monthStatus,
    },
    {
      kind:            'streak',
      id:              'first-week-streak',
      iconName:        'military-tech',
      iconColor:       '#F2994A',
      iconBackground:  '#F2994A1A',
      title:           'First Week Streak',
      subtitle:        streakCompleted ? 'Completed this week!' : `${streakRows.length}/7 days active`,
      completed:       streakCompleted,
    },
  ];

  // Points by source
  const [sourceRows] = await db.query(
    `SELECT activity, COALESCE(SUM(points), 0) AS pts
     FROM app_reward_points
     WHERE app_user_id = ? AND points > 0
     GROUP BY activity`,
    [patientId]
  );
  const sourceMap = {};
  sourceRows.forEach(r => { sourceMap[r.activity] = parseInt(r.pts); });

  const SOURCE_CONFIG = [
    { source: 'vitals',   label: 'Log Vitals',     activities: ['log-vitals'] },
    { source: 'exercise', label: 'Exercise',        activities: ['exercise'] },
    { source: 'meals',    label: 'Log Meals',       activities: ['log-meals'] },
    { source: 'surveys',  label: 'Weekly Survey',   activities: ['survey'] },
  ];

  const pointsBySource = SOURCE_CONFIG.map(cfg => ({
    source: cfg.source,
    label:  cfg.label,
    points: cfg.activities.reduce((sum, a) => sum + (sourceMap[a] || 0), 0),
  }));

  return {
    totalPoints,
    tierLabel:       getTier(totalPoints),
    pointsThisWeek:  weekTotals.weekPoints,
    pointsRedeemed:  totalRedeemed,
    activities:      ACTIVITY_CONFIG,
    milestones,
    pointsBySource,
    proTip:          'Logging your vitals before 9 AM earns you an "Early Bird" bonus. Stay consistent!',
  };
};

module.exports = { getRewardsSummary, awardPoints };
