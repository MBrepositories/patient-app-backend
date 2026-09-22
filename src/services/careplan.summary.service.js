const db = require('../config/db');

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const formatDateLabel = (d) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const getCarePlanSummary = async (patientId) => {
  const today = new Date();
  const todayStr = toDateStr(today);

  // ── Enrolled careplans ────────────────────────────────────────────────────
  const [enrolledRows] = await db.query(
    `SELECT apc.id, apc.plan_id, apc.start_date, apc.total_days, apc.status,
            cm.care_plan_name, cm.type, cm.duration_days
     FROM app_patient_careplans apc
     LEFT JOIN careplan_master cm ON cm.id = apc.plan_id
     WHERE apc.app_user_id = ? AND apc.status = 'active'
     ORDER BY apc.created_at ASC`,
    [patientId]
  );

  // ── Reward points ─────────────────────────────────────────────────────────
  const [[pointsRow]] = await db.query(
    `SELECT COALESCE(SUM(points), 0) AS total FROM app_reward_points WHERE app_user_id = ?`,
    [patientId]
  );
  const rewardPoints = Number(pointsRow.total) || 0;

  // ── Appointment count (doctor consultations) ──────────────────────────────
  const [[apptRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM appointments
     WHERE patient_id = ? AND status NOT IN ('cancelled', 'no-show')`,
    [patientId]
  );
  const consultationsDone = Number(apptRow.total) || 0;

  // ── Pending surveys ───────────────────────────────────────────────────────
  const [[surveyRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM app_survey_submissions WHERE app_user_id = ?`,
    [patientId]
  );
  const surveysDone = Number(surveyRow.total) || 0;

  // ── Diet chart ────────────────────────────────────────────────────────────
  const [[diet]] = await db.query(
    `SELECT pd.condition_type, u.name AS doctor_name
     FROM patient_diet pd
     LEFT JOIN users u ON u.id = pd.created_by
     WHERE pd.patient_id = ? ORDER BY pd.created_at DESC LIMIT 1`,
    [patientId]
  );

  // ── Build programs ────────────────────────────────────────────────────────
  const TYPE_MAP = {
    'Diabetes':  'diabetes',
    'CAD':       'cardiac',
    'HF':        'cardiac',
    'IHD':       'cardiac',
    'HTN':       'cardiac',
    'Obesity':   'diabetes',
  };

  const programs = enrolledRows.map((row, idx) => {
    // Safe date parsing — handle 0000-00-00 and timezone shift
    let startDate;
    const rawDate = row.start_date instanceof Date
      ? `${row.start_date.getFullYear()}-${String(row.start_date.getMonth()+1).padStart(2,'0')}-${String(row.start_date.getDate()).padStart(2,'0')}`
      : String(row.start_date || '').slice(0, 10);
    if (rawDate && !rawDate.startsWith('0000') && rawDate.length === 10) {
      const [y, m, d] = rawDate.split('-').map(Number);
      startDate = new Date(y, m - 1, d);
    } else {
      startDate = new Date(); // fallback to today
    }
    const totalDays = row.total_days || row.duration_days || 90;
    const diffMs    = today - startDate;
    const currentDay = Math.max(1, Math.min(totalDays, Math.floor(diffMs / 86400000) + 1));
    const overallPercent = Math.round((currentDay / totalDays) * 100);

    const planName = row.care_plan_name || '';
    const planType = row.type || '';
    const type     = TYPE_MAP[planType] || (planName.toLowerCase().includes('cardiac') ? 'cardiac' : 'diabetes');
    const tabLabel = type === 'cardiac' ? 'Cardiac' : 'Diabetes';

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + totalDays - 1);

    return {
      type,
      tabLabel,
      title:          planName || `${tabLabel} Reversal Program - ${totalDays} Days`,
      currentDay,
      totalDays,
      overallPercent: Math.min(100, overallPercent),
      isPrimary:      idx === 0,
      startDate,
      endDate,
      tasks: [
        {
          id:        'doctor-consultation',
          iconName:  'event',
          label:     'Doctor Consultation',
          completed: consultationsDone,
          target:    Math.ceil(totalDays / 15), // approx 1 per 15 days
        },
        {
          id:        'medicine',
          iconName:  'medication',
          label:     'Medicine Adherence',
          completed: Math.min(currentDay, totalDays),
          target:    totalDays,
        },
      ],
    };
  });

  // ── Journey progress (based on primary plan) ──────────────────────────────
  const primary = programs[0];
  let journeyProgress = null;
  if (primary) {
    const daysRemaining = Math.max(0, primary.totalDays - primary.currentDay);
    journeyProgress = {
      completePercent: primary.overallPercent,
      currentDay:      primary.currentDay,
      totalDays:       primary.totalDays,
      daysRemaining,
      rewardPoints,
      startDate: formatDateLabel(primary.startDate),
      endDate:   formatDateLabel(primary.endDate),
    };
  }

  // ── Quick links ───────────────────────────────────────────────────────────
  const quickLinks = [
    { id: 'survey',      iconName: 'assignment',    label: 'Survey',         badgeCount: Math.max(0, 4 - surveysDone) },
    { id: 'diet',        iconName: 'restaurant',    label: 'Diet Chart',     badgeCount: 0 },
    { id: 'vitals',      iconName: 'monitor-heart', label: 'Vitals',         badgeCount: 0 },
    { id: 'rewards',     iconName: 'star',          label: 'Rewards',        badgeCount: 0 },
  ];

  return {
    activePlansCount: programs.length,
    programs:         programs.map(({ startDate, endDate, ...p }) => p),
    dietChart: diet ? {
      title:          'Your Diet Chart',
      doctorName:     diet.doctor_name || 'Your Doctor',
      conditionLabel: `For ${diet.condition_type || 'Your Condition'}`,
    } : null,
    journeyProgress,
    quickLinks,
    therapies: [], // no therapy tracking table available yet
  };
};

module.exports = { getCarePlanSummary };
