const db = require('../config/db');
const { awardPoints } = require('./rewards.service');

// ─── Config ───────────────────────────────────────────────────────────────────

const VITAL_CONFIG = {
  weight: {
    unit: 'kg',
    helperText: 'Normal 60 - 90 kg',
    min: 20, max: 300,
    getStatus: (v) => (v >= 60 && v <= 90 ? 'good' : v <= 100 ? 'warning' : 'danger'),
  },
  hba1c: {
    unit: '%',
    helperText: 'Normal < 5.7%',
    min: 2, max: 20,
    getStatus: (v) => (v < 5.7 ? 'good' : v < 6.5 ? 'warning' : 'danger'),
  },
  ldl: {
    unit: 'mg/dL',
    helperText: 'Optimal < 100 mg/dL',
    min: 10, max: 400,
    getStatus: (v) => (v < 100 ? 'good' : v < 130 ? 'warning' : 'danger'),
  },
  waist: {
    unit: 'cm',
    helperText: 'Healthy threshold: <90 cm',
    min: 40, max: 200,
    goalValue: 90,
    getStatus: (v) => (v < 80 ? 'good' : v < 90 ? 'warning' : 'danger'),
  },
  height: {
    unit: 'cm',
    helperText: 'Recorded by hospital',
    min: 50, max: 250,
    getStatus: () => 'good',
  },
  bsl_fasting: {
    unit: 'mg/dL',
    helperText: 'Normal < 100 mg/dL',
    min: 10, max: 600,
    getStatus: (v) => (v < 100 ? 'good' : v < 126 ? 'warning' : 'danger'),
  },
  bsl_pp: {
    unit: 'mg/dL',
    helperText: 'Normal < 140 mg/dL',
    min: 10, max: 600,
    getStatus: (v) => (v < 140 ? 'good' : v < 200 ? 'warning' : 'danger'),
  },
};

const formatRecordedAt = (date) => {
  if (!date) return null;
  return new Date(date).toISOString();
};

// ─── 1. Vitals Summary ────────────────────────────────────────────────────────

const getVitalsSummary = async (patientId) => {
  // Latest self-logged value per type from app_vitals (including secondary_value for BP)
  const [appRows] = await db.query(
    `SELECT type, value, secondary_value, logged_at
     FROM app_vitals
     WHERE app_user_id = ? AND logged_at = (
       SELECT MAX(logged_at) FROM app_vitals av2
       WHERE av2.app_user_id = app_vitals.app_user_id AND av2.type = app_vitals.type
     )`,
    [patientId]
  );

  // Latest from hospital patient_vitals (weight, hba1c, waist, height, bsl, BP)
  const [hospRows] = await db.query(
    `SELECT weight, blood_sugar_hba1c AS hba1c, waist_circumference AS waist,
            height, blood_sugar_fasting AS bsl_fasting, blood_sugar_postprandial AS bsl_pp,
            blood_pressure_systolic AS bp_systolic, blood_pressure_diastolic AS bp_diastolic,
            recorded_at
     FROM patient_vitals
     WHERE patient_id = ? AND status = 'recorded'
     ORDER BY recorded_at DESC LIMIT 1`,
    [patientId]
  );

  // Merge: app_vitals takes priority over hospital data
  const hosp = hospRows[0] || {};
  const appMap = {};
  let lastRecordedAt = hosp.recorded_at || null;

  appRows.forEach(r => {
    appMap[r.type] = {
      value:          parseFloat(r.value),
      secondaryValue: r.secondary_value != null ? parseFloat(r.secondary_value) : null,
      logged_at:      r.logged_at,
    };
    if (!lastRecordedAt || new Date(r.logged_at) > new Date(lastRecordedAt)) {
      lastRecordedAt = r.logged_at;
    }
  });

  const hospFallback = {
    weight:      hosp.weight      ? parseFloat(hosp.weight)      : null,
    hba1c:       hosp.hba1c       ? parseFloat(hosp.hba1c)       : null,
    waist:       hosp.waist       ? parseFloat(hosp.waist)       : null,
    ldl:         null,
    height:      hosp.height      ? parseFloat(hosp.height)      : null,
    bsl_fasting: hosp.bsl_fasting ? parseFloat(hosp.bsl_fasting) : null,
    bsl_pp:      hosp.bsl_pp      ? parseFloat(hosp.bsl_pp)      : null,
  };

  const readings = Object.entries(VITAL_CONFIG).map(([type, cfg]) => {
    const appVal = appMap[type]?.value ?? null;
    const value  = appVal !== null ? appVal : hospFallback[type];
    if (value === null) return null;

    const status = cfg.getStatus(value);
    const prev   = null;

    const reading = {
      id:         type,
      type,
      value,
      unit:       cfg.unit,
      badgeText:  'First reading',
      status,
      helperText: cfg.helperText,
    };

    if (cfg.goalValue) {
      reading.progressPercent = Math.min(100, Math.round((value / cfg.goalValue) * 100));
    }

    return reading;
  }).filter(Boolean);

  // Blood pressure — app_vitals first, then hospital fallback
  const appBp = appMap['blood_pressure'];
  const hospBpSys = hosp.bp_systolic ? parseFloat(hosp.bp_systolic) : null;
  const hospBpDia = hosp.bp_diastolic ? parseFloat(hosp.bp_diastolic) : null;

  const bpSys = appBp ? appBp.value : hospBpSys;
  const bpDia = appBp ? appBp.secondaryValue : hospBpDia;

  if (bpSys != null && bpDia != null) {
    const bpStatus = bpSys >= 140 || bpDia >= 90 ? 'danger' : bpSys >= 120 || bpDia >= 80 ? 'warning' : 'good';
    readings.push({
      id:             'blood_pressure',
      type:           'blood_pressure',
      value:          bpSys,
      secondaryValue: bpDia,
      unit:           'mmHg',
      badgeText:      'First reading',
      status:         bpStatus,
      helperText:     'Normal < 120/80 mmHg',
    });
  }

  return {
    lastRecordedAt: formatRecordedAt(lastRecordedAt),
    readings,
  };
};

// ─── 2. Log Vitals ────────────────────────────────────────────────────────────

const VALID_RANGES = {
  weight:         { min: 20,  max: 300 },
  hba1c:          { min: 2,   max: 20  },
  ldl:            { min: 10,  max: 400 },
  waist:          { min: 40,  max: 200 },
  height:         { min: 50,  max: 250 },
  bsl_fasting:    { min: 10,  max: 600 },
  bsl_pp:         { min: 10,  max: 600 },
  blood_pressure: { min: 60,  max: 250, minSecondary: 40, maxSecondary: 150 }, // systolic / diastolic
};

const logVitals = async (patientId, readings) => {
  // Validate
  for (const r of readings) {
    const cfg = VALID_RANGES[r.type];
    if (!cfg) {
      const err = new Error(`Invalid vital type: ${r.type}`);
      err.statusCode = 400;
      throw err;
    }
    if (r.value < cfg.min || r.value > cfg.max) {
      const err = new Error(`Value for ${r.type} is out of physiological range (${cfg.min}–${cfg.max}).`);
      err.statusCode = 400;
      throw err;
    }
    if (r.type === 'blood_pressure') {
      if (r.secondaryValue == null) {
        const err = new Error('secondaryValue (diastolic) is required for blood_pressure.');
        err.statusCode = 400;
        throw err;
      }
      if (r.secondaryValue < cfg.minSecondary || r.secondaryValue > cfg.maxSecondary) {
        const err = new Error(`Diastolic value is out of physiological range (${cfg.minSecondary}–${cfg.maxSecondary}).`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const now = new Date();

  // Insert each reading (secondary_value used for blood_pressure diastolic)
  await Promise.all(readings.map(r =>
    db.query(
      `INSERT INTO app_vitals (app_user_id, type, value, secondary_value, logged_at) VALUES (?, ?, ?, ?, ?)`,
      [patientId, r.type, r.value, r.secondaryValue ?? null, now]
    )
  ));

  // Award points for logging vitals (once per day)
  awardPoints(patientId, 'log-vitals').catch(() => {});

  // Trigger vitals notification
  const typeLabels = readings.map(r => r.type.charAt(0).toUpperCase() + r.type.slice(1)).join(', ');
  db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'vitals', 'Vitals Logged', ?)`,
    [patientId, `You have successfully logged your vitals: ${typeLabels}.`]
  ).catch(() => {});

  // Create persistent vitals activity in chat thread
  const VITAL_LABELS = {
    weight:         { label: 'Weight',                unit: 'kg'    },
    waist:          { label: 'Waist',                 unit: 'cm'    },
    height:         { label: 'Height',                unit: 'cm'    },
    hba1c:          { label: 'HbA1c',                 unit: '%'     },
    ldl:            { label: 'LDL',                   unit: 'mg/dL' },
    bsl_fasting:    { label: 'Blood Sugar (Fasting)', unit: 'mg/dL' },
    bsl_pp:         { label: 'Blood Sugar (PP)',       unit: 'mg/dL' },
    blood_pressure: { label: 'Blood Pressure',        unit: 'mmHg'  },
  };
  const summaryParts = readings.map(r => {
    if (r.type === 'blood_pressure') {
      return `Blood Pressure ${r.value}/${r.secondaryValue} mmHg`;
    }
    const meta = VITAL_LABELS[r.type] || { label: r.type, unit: '' };
    return `${meta.label} ${r.value}${meta.unit ? ' ' + meta.unit : ''}`;
  });
  const activitySummary = `Vitals updated: ${summaryParts.join(', ')}`;
  db.query(
    `INSERT INTO app_chat_messages (patient_id, sender, sender_name, text, created_at) VALUES (?, 'activity', 'vitals', ?, UTC_TIMESTAMP())`,
    [patientId, activitySummary]
  ).catch(() => {});

  return {
    recordedAt: formatRecordedAt(now),
  };
};

// ─── 3. Vitals History ────────────────────────────────────────────────────────

const APP_VITAL_META = {
  weight:      { label: 'Weight',      unit: 'kg',    iconName: 'monitor-weight', iconColor: '#4A90D9', iconBackground: '#4A90D91A', getStatus: (v) => (v >= 60 && v <= 90 ? 'good' : v <= 100 ? 'warning' : 'danger') },
  hba1c:       { label: 'HbA1c',       unit: '%',     iconName: 'bloodtype',      iconColor: '#E63950', iconBackground: '#E639501A', getStatus: (v) => (v < 5.7 ? 'good' : v < 6.5 ? 'warning' : 'danger') },
  ldl:         { label: 'LDL',         unit: 'mg/dL', iconName: 'science',        iconColor: '#F5A623', iconBackground: '#F5A6231A', getStatus: (v) => (v < 100 ? 'good' : v < 130 ? 'warning' : 'danger') },
  waist:       { label: 'Waist',       unit: 'cm',    iconName: 'straighten',     iconColor: '#7B61FF', iconBackground: '#7B61FF1A', getStatus: (v) => (v < 80 ? 'good' : v < 90 ? 'warning' : 'danger') },
  height:      { label: 'Height',      unit: 'cm',    iconName: 'height',         iconColor: '#27AE60', iconBackground: '#27AE601A', getStatus: () => 'good' },
  bsl_fasting: { label: 'BSL Fasting', unit: 'mg/dL', iconName: 'water-drop',     iconColor: '#F2994A', iconBackground: '#F2994A1A', getStatus: (v) => (v < 100 ? 'good' : v < 126 ? 'warning' : 'danger') },
  bsl_pp:      { label: 'BSL PP',      unit: 'mg/dL', iconName: 'water-drop',     iconColor: '#EB5757', iconBackground: '#EB57571A', getStatus: (v) => (v < 140 ? 'good' : v < 200 ? 'warning' : 'danger') },
};

const getVitalsHistory = async (patientId) => {
  const now = new Date();

  const ranges = {
    '7D':  { days: 7,    format: (d) => d.toLocaleDateString('en-US', { weekday: 'short' }) },
    '30D': { days: 30,   format: (d) => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` },
    '90D': { days: 90,   format: (d) => d.toLocaleDateString('en-US', { month: 'short' }) },
    'All': { days: null, format: (d) => d.toLocaleDateString('en-US', { month: 'short' }) },
  };

  // ── Blood pressure: hospital recorded + app self-logged (merged) ─────────────
  const [[hospBpRows], [appBpRows]] = await Promise.all([
    db.query(
      `SELECT blood_pressure_systolic AS systolic, blood_pressure_diastolic AS diastolic, recorded_at
       FROM patient_vitals
       WHERE patient_id = ? AND status = 'recorded' AND blood_pressure_systolic IS NOT NULL
       ORDER BY recorded_at ASC`,
      [patientId]
    ),
    db.query(
      `SELECT value AS systolic, secondary_value AS diastolic, logged_at AS recorded_at
       FROM app_vitals
       WHERE app_user_id = ? AND type = 'blood_pressure' AND secondary_value IS NOT NULL
       ORDER BY logged_at ASC`,
      [patientId]
    ),
  ]);

  // Merge and sort oldest → newest
  const bpRows = [...hospBpRows, ...appBpRows].sort(
    (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
  );

  const bloodPressureTrendByRange = {};
  for (const [range, cfg] of Object.entries(ranges)) {
    const cutoff = cfg.days ? new Date(now - cfg.days * 86400000) : null;
    const filtered = bpRows.filter(r => !cutoff || new Date(r.recorded_at) >= cutoff);
    const maxPoints = range === '7D' ? 7 : range === '30D' ? 10 : 6;
    const step = Math.max(1, Math.ceil(filtered.length / maxPoints));
    bloodPressureTrendByRange[range] = filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map((r, i, arr) => ({
        dateLabel: cfg.format(new Date(r.recorded_at)),
        systolic:  parseFloat(r.systolic),
        diastolic: parseFloat(r.diastolic),
        showLabel: i === 0 || i === arr.length - 1 || i % 2 === 0,
      }));
  }

  // Stats — latest BP
  const latestBp = bpRows[bpRows.length - 1];
  const stats = latestBp ? [{
    id:          'blood-pressure',
    label:       'Blood Pressure',
    value:       `${latestBp.systolic}/${latestBp.diastolic}`,
    unit:        'mmHg',
    iconName:    'water-drop',
    highlighted: true,
    hasWarning:  parseFloat(latestBp.systolic) >= 140 || parseFloat(latestBp.diastolic) >= 90,
  }] : [];

  // Recent BP readings (last 10)
  const recentBp = bpRows.slice(-10).reverse();
  const recentReadings = recentBp.map((r, i) => {
    const sys = parseFloat(r.systolic);
    const dia = parseFloat(r.diastolic);
    const isHigh = sys >= 140 || dia >= 90;
    const isLow  = sys < 90  || dia < 60;
    const d = new Date(r.recorded_at);
    const isToday = d.toDateString() === now.toDateString();
    const timeLabel = isToday
      ? 'Today, ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }) + ', ' +
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      id:             `reading-bp-${i}`,
      iconName:       'water-drop',
      iconColor:      '#E63950',
      iconBackground: '#E639501A',
      title:          `${sys}/${dia} mmHg`,
      timeLabel,
      statusLabel:    isHigh ? 'High' : isLow ? 'Low' : 'Normal',
      statusTone:     isHigh ? 'high' : isLow ? 'low' : 'good',
    };
  });

  // ── App-logged vitals history (all types except blood_pressure — handled above) ──
  const [appRows] = await db.query(
    `SELECT type, value, logged_at FROM app_vitals
     WHERE app_user_id = ? AND type != 'blood_pressure' ORDER BY logged_at ASC`,
    [patientId]
  );

  // Group rows by type
  const appByType = {};
  appRows.forEach(r => {
    if (!appByType[r.type]) appByType[r.type] = [];
    appByType[r.type].push(r);
  });

  const appVitalsTrendByType = {};

  for (const [type, meta] of Object.entries(APP_VITAL_META)) {
    const rows = appByType[type] || [];
    const trendByRange = {};

    for (const [range, cfg] of Object.entries(ranges)) {
      const cutoff = cfg.days ? new Date(now - cfg.days * 86400000) : null;
      const filtered = rows.filter(r => !cutoff || new Date(r.logged_at) >= cutoff);
      const maxPoints = range === '7D' ? 7 : range === '30D' ? 10 : 6;
      const step = Math.max(1, Math.ceil(filtered.length / maxPoints));
      trendByRange[range] = filtered
        .filter((_, i) => i % step === 0 || i === filtered.length - 1)
        .map((r, i, arr) => ({
          dateLabel: cfg.format(new Date(r.logged_at)),
          value:     parseFloat(r.value),
          showLabel: i === 0 || i === arr.length - 1 || i % 2 === 0,
        }));
    }

    // Recent readings for this type (last 10)
    const recent = rows.slice(-10).reverse().map((r, i) => {
      const val = parseFloat(r.value);
      const status = meta.getStatus(val);
      const d = new Date(r.logged_at);
      const isToday = d.toDateString() === now.toDateString();
      const timeLabel = isToday
        ? 'Today, ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }) + ', ' +
          d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return {
        id:             `reading-${type}-${i}`,
        iconName:       meta.iconName,
        iconColor:      meta.iconColor,
        iconBackground: meta.iconBackground,
        title:          `${val} ${meta.unit}`,
        timeLabel,
        statusLabel:    status === 'good' ? 'Normal' : status === 'warning' ? 'Warning' : 'High',
        statusTone:     status,
      };
    });

    appVitalsTrendByType[type] = {
      label:        meta.label,
      unit:         meta.unit,
      iconName:     meta.iconName,
      trendByRange,
      recentReadings: recent,
    };
  }

  return { bloodPressureTrendByRange, stats, recentReadings, appVitalsTrendByType };
};

// ─── 4. Water Intake ──────────────────────────────────────────────────────────

const logWater = async (patientId, glasses) => {
  if (!glasses || glasses < 1 || glasses > 30) {
    const err = new Error('glasses must be between 1 and 30');
    err.statusCode = 400;
    throw err;
  }

  await db.query(
    `INSERT INTO app_vitals (app_user_id, type, value, logged_at) VALUES (?, 'water', ?, NOW())`,
    [patientId, glasses]
  );

  const [[row]] = await db.query(
    `SELECT COALESCE(SUM(value), 0) AS total
     FROM app_vitals
     WHERE app_user_id = ? AND type = 'water' AND DATE(logged_at) = CURDATE()`,
    [patientId]
  );

  return { totalGlassesToday: parseInt(row.total) };
};

const getWater = async (patientId) => {
  const [[row]] = await db.query(
    `SELECT COALESCE(SUM(value), 0) AS total
     FROM app_vitals
     WHERE app_user_id = ? AND type = 'water' AND DATE(logged_at) = CURDATE()`,
    [patientId]
  );

  return { totalGlassesToday: parseInt(row.total) };
};

module.exports = { getVitalsSummary, logVitals, getVitalsHistory, logWater, getWater };
