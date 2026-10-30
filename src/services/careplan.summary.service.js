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

  // ── All appointments (filtered per-plan by start_date below) ────────────
  const [apptRows] = await db.query(
    `SELECT appointment_date FROM appointments
     WHERE patient_id = ? AND status NOT IN ('cancelled', 'no-show')`,
    [patientId]
  );

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
  const PLAN_VITAL_MAP = {
    1:   'hba1c',
    2:   'ldl',
    3:   'bloodPressure',
    4:   'weight',
    5:   'weight',
    6:   null,
    561: 'bloodPressure', // BMP 1
  };

  const TYPE_MAP = {
    'Diabetes':  'diabetes',
    'CAD':       'cardiac',
    'HF':        'cardiac',
    'IHD':       'cardiac',
    'HTN':       'cardiac',
    'Obesity':   'diabetes',
    'Heart':     'cardiac',
    'HEART':     'cardiac',
    'Cardiac':   'cardiac',
    'CARDIAC':   'cardiac',
    'DETOX':     'detox',
    'Detox':     'detox',
  };

  const TAB_LABEL_MAP = { cardiac: 'Cardiac', diabetes: 'Diabetes', detox: 'Detox' };

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
      startDate = new Date();
    }
    const totalDays  = row.total_days || row.duration_days || 90;
    const diffMs     = today - startDate;
    const currentDay = Math.max(1, Math.min(totalDays, Math.floor(diffMs / 86400000) + 1));
    const overallPercent = Math.round((currentDay / totalDays) * 100);

    const planName = row.care_plan_name || '';
    const planType = row.type || '';
    const type     = TYPE_MAP[planType] || (planName.toLowerCase().includes('cardiac') ? 'cardiac' : 'diabetes');
    const tabLabel = TAB_LABEL_MAP[type] || planType || 'Other';

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + totalDays - 1);

    // Consultations since this plan's start date (not all-time)
    const consultationsDone = apptRows.filter(a => {
      const d = a.appointment_date instanceof Date
        ? a.appointment_date
        : new Date(String(a.appointment_date).slice(0, 10));
      return d >= startDate;
    }).length;

    return {
      type,
      tabLabel,
      title:          planName || `${tabLabel} Reversal Program - ${totalDays} Days`,
      currentDay,
      totalDays,
      overallPercent: Math.min(100, overallPercent),
      isPrimary:      idx === 0,
      alignedVital:   PLAN_VITAL_MAP[row.plan_id] ?? null,
      startDate,
      endDate,
      tasks: [
        {
          id:        'doctor-consultation',
          iconName:  'event',
          label:     'Doctor Consultation',
          completed: Math.min(consultationsDone, Math.ceil(totalDays / 15)),
          target:    Math.ceil(totalDays / 15),
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

  // ── Therapies (from patient_cp_schedule) ─────────────────────────────────
  const [therapyRows] = await db.query(
    `SELECT pcs.item_name,
            COUNT(*)        AS total_sessions,
            SUM(pcs.consumed)   AS completed_sessions,
            MAX(ci.repeat_interval_type) AS repeat_interval_type
     FROM patient_cp_schedule pcs
     LEFT JOIN cp_items ci ON ci.id = pcs.cp_item_id
     WHERE pcs.patient_id = ?
     GROUP BY pcs.item_name
     HAVING total_sessions > 0`,
    [patientId]
  );

  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const therapies = therapyRows.map(r => {
    const completed  = Number(r.completed_sessions) || 0;
    const total      = Number(r.total_sessions) || 0;
    const percent    = total > 0 ? Math.round((completed / total) * 100) : 0;
    const repeatType = r.repeat_interval_type || 'daily';
    const scheduleLabel = repeatType === 'weekly' ? 'Weekly' : repeatType === 'once' ? 'Once' : 'Daily (Mon-Sat)';
    return {
      id:       slugify(r.item_name),
      iconName: 'show-chart',
      title:    r.item_name,
      subtitle: `${completed} / ${total} completed • ${scheduleLabel}`,
      percent,
    };
  });

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
    therapies,
  };
};

// ─── GET /careplan/therapies/:id ─────────────────────────────────────────────
const getTherapyDetail = async (patientId, therapyId) => {
  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Find all sessions for this patient, match by slug
  const [allRows] = await db.query(
    `SELECT pcs.*, ci.repeat_interval_type
     FROM patient_cp_schedule pcs
     LEFT JOIN cp_items ci ON ci.id = pcs.cp_item_id
     WHERE pcs.patient_id = ?
     ORDER BY pcs.scheduled_date DESC`,
    [patientId]
  );

  const rows = allRows.filter(r => slugify(r.item_name) === therapyId);
  if (rows.length === 0) {
    const err = new Error('Therapy not found.'); err.statusCode = 404; throw err;
  }

  const title      = rows[0].item_name;
  const repeatType = rows[0].repeat_interval_type || 'daily';
  const schedule   = repeatType === 'weekly' ? 'Weekly' : repeatType === 'once' ? 'Once' : 'Daily (Mon-Sat)';

  const todayStr = toDateStr(new Date());
  const completed = rows.filter(r => r.consumed === 1 || r.consumed === true).length;
  const total     = rows.length;

  // Sessions list (newest first)
  const sessions = rows.map(r => {
    const dateStr = r.scheduled_date instanceof Date
      ? toDateStr(r.scheduled_date)
      : String(r.scheduled_date).slice(0, 10);
    let status;
    if (r.consumed === 1 || r.consumed === true) status = 'completed';
    else if (dateStr < todayStr) status = 'missed';
    else status = 'upcoming';
    return { date: dateStr, status };
  });

  // Next upcoming session
  const upcoming = sessions.filter(s => s.status === 'upcoming').sort((a, b) => a.date.localeCompare(b.date));
  let nextSession = null;
  if (upcoming.length > 0) {
    const nextDate = upcoming[0].date;
    // Try to get branch from appointments
    const [[appt]] = await db.query(
      `SELECT a.appointment_time, b.branch_name
       FROM appointments a
       LEFT JOIN branches b ON b.id = a.branch_id
       WHERE a.patient_id = ? AND DATE(a.appointment_date) = ? AND a.appointment_type = 'therapy'
       LIMIT 1`,
      [patientId, nextDate]
    );
    const timeLabel = appt?.appointment_time
      ? new Date(`1970-01-01T${appt.appointment_time}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase()
      : null;
    nextSession = {
      date:       nextDate,
      time:       timeLabel,
      branchName: appt?.branch_name || null,
    };
  }

  return { id: therapyId, title, schedule, completedSessions: completed, totalSessions: total, nextSession, sessions };
};

module.exports = { getCarePlanSummary, getTherapyDetail };
