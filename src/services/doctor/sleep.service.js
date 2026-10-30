const db = require('../../config/db');

const formatNight = (r) => {
  const stages = {
    awake:  r.stage_awake,
    light:  r.stage_light,
    deep:   r.stage_deep,
    rem:    r.stage_rem,
    asleep: r.stage_asleep,
  };
  const allNull = Object.values(stages).every(v => v === null || v === undefined || v === 0);

  return {
    date:                 r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
    sleepStart:           r.sleep_start ? new Date(r.sleep_start).toISOString() : null,
    wakeTime:             r.wake_time   ? new Date(r.wake_time).toISOString()   : null,
    durationMinutes:      r.duration_minutes,
    timeInBedMinutes:     r.time_in_bed_minutes,
    source:               r.source,
    sourceName:           r.source_name,
    confidence:           r.confidence,
    efficiencyPercent:    r.efficiency_percent,
    awakenings:           r.awakenings,
    sleepLatencyMinutes:  r.sleep_latency_minutes,
    disturbances:         r.disturbances,
    stageMinutes:         allNull ? null : stages,
    lowMotionSignal:      !!r.low_motion_signal,
    trackingNotStopped:   !!r.tracking_not_stopped,
    sleepScore:           r.sleep_score,
    sleepQuality:         r.sleep_quality,
  };
};

const getPatientSleep = async (doctorId, patientId, { from, to } = {}) => {
  // 1. Check patient exists
  const [[patient]] = await db.query(
    `SELECT id FROM patients WHERE id = ? LIMIT 1`,
    [patientId]
  );
  if (!patient) {
    const err = new Error('Patient not found.');
    err.statusCode = 404;
    throw err;
  }

  // 2. Check doctor is assigned to this patient (branch-based)
  const [[assigned]] = await db.query(
    `SELECT p.id FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id
     WHERE p.id = ? AND u.id = ? AND p.status = 'active'
     LIMIT 1`,
    [patientId, doctorId]
  );
  if (!assigned) {
    const err = new Error('Patient not assigned to this doctor.');
    err.statusCode = 403;
    throw err;
  }

  // 3. Default date range: last 30 days
  const toDate   = to   || new Date().toISOString().split('T')[0];
  const fromDate = from || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  })();

  // 4. Fetch sleep nights
  const [rows] = await db.query(
    `SELECT * FROM app_sleep_logs
     WHERE app_user_id = ? AND date BETWEEN ? AND ?
     ORDER BY date DESC`,
    [patientId, fromDate, toDate]
  );

  if (rows.length === 0) {
    return { sharingEnabled: false, lastSyncedAt: null, nights: [] };
  }

  const lastSyncedAt = new Date(rows[0].updated_at).toISOString();

  return {
    sharingEnabled: true,
    lastSyncedAt,
    nights: rows.map(formatNight),
  };
};

module.exports = { getPatientSleep };
