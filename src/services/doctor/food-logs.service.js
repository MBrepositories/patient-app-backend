const db = require('../../config/db');

const PAGE_SIZE = 10;

const getRiskLevel = (calories) => {
  if (calories > 800) return 'critical';
  if (calories > 500) return 'high';
  return 'normal';
};

const getRiskTagLabel = (calories, mealPeriod) => {
  if (calories > 800) return 'CRITICAL SUGAR';
  if (calories > 500) return 'HIGH CALORIES';
  return 'NORMAL';
};

const toTimestampLabel = (loggedAt) => {
  const now = new Date();
  const d = new Date(loggedAt);
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return isToday ? `Today ${timeStr}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${timeStr}`;
};

const getFoodLogs = async ({ riskLevel, mealType, page = 1 }) => {
  const offset = (parseInt(page) - 1) * PAGE_SIZE;

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [[statsRow]] = await db.query(
    `SELECT
       COUNT(*) AS totalLogs24h,
       SUM(CASE WHEN estimated_calories > 800 THEN 1 ELSE 0 END) AS criticalCount,
       SUM(CASE WHEN estimated_calories > 500 AND estimated_calories <= 800 THEN 1 ELSE 0 END) AS highCount
     FROM app_meal_logs
     WHERE logged_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
  );

  const totalLogs24h   = Number(statsRow.totalLogs24h) || 0;
  const criticalCount  = Number(statsRow.criticalCount) || 0;
  const highCount      = Number(statsRow.highCount) || 0;
  const normalCount    = totalLogs24h - criticalCount - highCount;
  const compliancePct  = totalLogs24h > 0 ? Math.round((normalCount / totalLogs24h) * 100) : 0;
  const complianceLabel = compliancePct >= 80 ? 'Optimal' : compliancePct >= 50 ? 'Moderate' : 'Low';

  // ── Build filters ──────────────────────────────────────────────────────────
  const conditions = [];
  const params = [];

  if (mealType && mealType !== 'all') {
    conditions.push('f.meal_period = ?');
    params.push(mealType);
  }

  if (riskLevel && riskLevel !== 'all') {
    if (riskLevel === 'critical') {
      conditions.push('f.estimated_calories > 800');
    } else if (riskLevel === 'high') {
      conditions.push('f.estimated_calories > 500 AND f.estimated_calories <= 800');
    } else if (riskLevel === 'normal') {
      conditions.push('f.estimated_calories <= 500');
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // ── Count ─────────────────────────────────────────────────────────────────
  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM app_meal_logs f ${whereClause}`,
    params
  );
  const totalEntries = Number(countRow.total) || 0;

  // ── Entries ───────────────────────────────────────────────────────────────
  const [rows] = await db.query(
    `SELECT
       f.id, f.meal_period, f.notes, f.estimated_calories, f.logged_at,
       p.patient_name, p.patient_id AS uhid,
       mp.photo_url
     FROM app_meal_logs f
     LEFT JOIN patients p ON p.id = f.patient_id
     LEFT JOIN app_meal_photos mp
       ON mp.patient_id = f.patient_id
       AND mp.meal_period = f.meal_period
       AND DATE(mp.uploaded_at) = DATE(f.logged_at)
     ${whereClause}
     ORDER BY f.logged_at DESC
     LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  );

  const entries = rows.map((r) => {
    const calories = r.estimated_calories || 0;
    const risk     = getRiskLevel(calories);
    const initials = (r.patient_name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return {
      id:              `food-log-${r.id}`,
      patientName:     r.patient_name || 'Unknown',
      patientInitials: initials,
      patientCode:     `#${r.uhid || r.id}`,
      timestampLabel:  toTimestampLabel(r.logged_at),
      mealTypeLabel:   r.meal_period.charAt(0).toUpperCase() + r.meal_period.slice(1),
      nutrientsLabel:  `${calories} kcal`,
      description:     r.notes || '',
      photoUrl:        r.photo_url || null,
      riskLevel:       risk,
      riskTagLabel:    getRiskTagLabel(calories, r.meal_period),
    };
  });

  return {
    stats: {
      totalLogs24h,
      totalLogsTrendLabel:      '+0% vs avg',
      criticalCount,
      highCount,
      visualCompliancePercent:  compliancePct,
      complianceStatusLabel:    complianceLabel,
    },
    filterOptions: {
      riskLevels:    [{ id: 'all', label: 'All' }, { id: 'critical', label: 'Critical' }, { id: 'high', label: 'High' }, { id: 'normal', label: 'Normal' }],
      mealTypes:     [{ id: 'all', label: 'All' }, { id: 'breakfast', label: 'Breakfast' }, { id: 'lunch', label: 'Lunch' }, { id: 'dinner', label: 'Dinner' }, { id: 'snack', label: 'Snack' }],
      nutrientFlags: [{ id: 'all', label: 'All' }, { id: 'sugar', label: 'Sugar' }, { id: 'sodium', label: 'Sodium' }, { id: 'fat', label: 'Fat' }],
    },
    entries,
    totalEntries,
    page:     parseInt(page),
    pageSize: PAGE_SIZE,
  };
};

module.exports = { getFoodLogs };
