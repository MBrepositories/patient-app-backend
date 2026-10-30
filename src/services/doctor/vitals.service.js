const db = require('../../config/db');

const RANGE_DAYS = { '7D': 7, '30D': 30, '90D': 90, 'All': null };

const APP_VITAL_CONFIG = [
  {
    type: 'bsl_fasting', label: 'Blood Sugar (Fasting)', unit: 'mg/dL',
    getStatus: (v) => v < 100 ? 'normal' : 'high',
  },
  {
    type: 'bsl_pp', label: 'Blood Sugar (PP)', unit: 'mg/dL',
    getStatus: (v) => v < 140 ? 'normal' : 'high',
  },
  {
    type: 'weight', label: 'Weight', unit: 'kg',
    getStatus: (v) => (v >= 60 && v <= 90) ? 'normal' : v < 60 ? 'low' : 'high',
  },
  {
    type: 'hba1c', label: 'HbA1c', unit: '%',
    getStatus: (v) => v < 5.7 ? 'normal' : 'high',
  },
  {
    type: 'ldl', label: 'LDL', unit: 'mg/dL',
    getStatus: (v) => v < 100 ? 'normal' : 'high',
  },
  {
    type: 'waist', label: 'Waist', unit: 'cm',
    getStatus: (v) => v < 90 ? 'normal' : 'high',
  },
];

const getBpStatus = (sys, dia) => {
  if (sys >= 140 || dia >= 90) return 'high';
  if (sys < 90  || dia < 60)  return 'low';
  return 'normal';
};

const getPulseStatus = (v) => {
  if (v > 100) return 'high';
  if (v < 60)  return 'low';
  return 'normal';
};

const getPatientVitals = async (doctorId, patientId, range = '30D') => {
  // 1. Check patient exists
  const [[patient]] = await db.query(
    `SELECT id FROM patients WHERE id = ? LIMIT 1`,
    [patientId]
  );
  if (!patient) throw Object.assign(new Error('Patient not found.'), { statusCode: 404 });

  // 2. Check doctor access (same branch)
  const [[assigned]] = await db.query(
    `SELECT p.id FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id
     WHERE p.id = ? AND u.id = ? AND p.status = 'active'
     LIMIT 1`,
    [patientId, doctorId]
  );
  if (!assigned) throw Object.assign(new Error('Patient not assigned to this doctor.'), { statusCode: 403 });

  // 3. Compute date cutoff
  const days = Object.prototype.hasOwnProperty.call(RANGE_DAYS, range)
    ? RANGE_DAYS[range]
    : RANGE_DAYS['30D'];

  const cutoff = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  // 4. Query patient_vitals (BP + pulse) and app_vitals in parallel
  const bpParams    = cutoff ? [patientId, cutoff] : [patientId];
  const appParams   = cutoff ? [patientId, cutoff] : [patientId];

  const [[hospBpRows], [appBpRows], [appRows]] = await Promise.all([
    db.query(
      `SELECT blood_pressure_systolic AS systolic, blood_pressure_diastolic AS diastolic,
              pulse_rate, recorded_at
       FROM patient_vitals
       WHERE patient_id = ? AND status = 'recorded'
         ${cutoff ? 'AND recorded_at >= ?' : ''}
       ORDER BY recorded_at DESC`,
      bpParams
    ),
    db.query(
      `SELECT value AS systolic, secondary_value AS diastolic, logged_at AS recorded_at
       FROM app_vitals
       WHERE app_user_id = ? AND type = 'blood_pressure' AND secondary_value IS NOT NULL
         ${cutoff ? 'AND logged_at >= ?' : ''}
       ORDER BY logged_at DESC`,
      appParams
    ),
    db.query(
      `SELECT type, value, secondary_value, logged_at
       FROM app_vitals
       WHERE app_user_id = ? AND type != 'blood_pressure'
         ${cutoff ? 'AND logged_at >= ?' : ''}
       ORDER BY logged_at DESC`,
      appParams
    ),
  ]);

  // 6. Build BP readings — merge hospital + app, sorted newest first
  const bpReadings = [...hospBpRows, ...appBpRows]
    .filter(r => r.systolic != null && r.diastolic != null)
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
    .map(r => ({
      recordedAt:     new Date(r.recorded_at).toISOString(),
      value:          parseFloat(r.systolic),
      secondaryValue: parseFloat(r.diastolic),
      status:         getBpStatus(parseFloat(r.systolic), parseFloat(r.diastolic)),
    }));

  // 7. Build pulse readings (hospital only — app doesn't log pulse)
  const pulseReadings = hospBpRows
    .filter(r => r.pulse_rate != null)
    .map(r => ({
      recordedAt:     new Date(r.recorded_at).toISOString(),
      value:          parseFloat(r.pulse_rate),
      secondaryValue: null,
      status:         getPulseStatus(parseFloat(r.pulse_rate)),
    }));

  // 8. Group app_vitals by type (blood_pressure excluded from appRows query)
  const byType = {};
  for (const r of appRows) {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push(r);
  }

  // 9. Build app vitals
  const appVitals = APP_VITAL_CONFIG.map(cfg => ({
    type:     cfg.type,
    label:    cfg.label,
    unit:     cfg.unit,
    readings: (byType[cfg.type] || []).map(r => ({
      recordedAt:     new Date(r.logged_at).toISOString(),
      value:          parseFloat(r.value),
      secondaryValue: null,
      status:         cfg.getStatus(parseFloat(r.value)),
    })),
  }));

  return {
    vitals: [
      { type: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', readings: bpReadings },
      { type: 'pulse',          label: 'Pulse',          unit: 'bpm',  readings: pulseReadings },
      ...appVitals,
    ],
  };
};

module.exports = { getPatientVitals };
