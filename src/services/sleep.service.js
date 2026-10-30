const db = require('../config/db');

const formatNight = (r) => ({
  date:                  r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
  sleepStart:            r.sleep_start ? new Date(r.sleep_start).toISOString() : null,
  wakeTime:              r.wake_time   ? new Date(r.wake_time).toISOString()   : null,
  durationMinutes:       r.duration_minutes,
  timeInBedMinutes:      r.time_in_bed_minutes,
  timezoneOffsetMinutes: r.timezone_offset_minutes,
  source:                r.source,
  sourceName:            r.source_name,
  confidence:            r.confidence,
  efficiencyPercent:     r.efficiency_percent,
  awakenings:            r.awakenings,
  sleepLatencyMinutes:   r.sleep_latency_minutes,
  disturbances:          r.disturbances,
  stageMinutes: {
    awake:   r.stage_awake,
    light:   r.stage_light,
    deep:    r.stage_deep,
    rem:     r.stage_rem,
    asleep:  r.stage_asleep,
  },
  lowMotionSignal:      !!r.low_motion_signal,
  trackingNotStopped:   !!r.tracking_not_stopped,
  sleepScore:           r.sleep_score,
  sleepQuality:         r.sleep_quality,
});

// ─── POST /sleep/sync ─────────────────────────────────────────────────────────
const syncSleep = async (patientId, { timezoneOffsetMinutes, nights = [], deletedDates = [] }) => {
  // Upsert each night
  for (const n of nights) {
    const stages = n.stageMinutes || {};
    await db.query(
      `INSERT INTO app_sleep_logs
         (app_user_id, date, sleep_start, wake_time, duration_minutes, time_in_bed_minutes,
          timezone_offset_minutes, source, source_name, confidence, efficiency_percent,
          awakenings, sleep_latency_minutes, disturbances,
          stage_awake, stage_light, stage_deep, stage_rem, stage_asleep,
          low_motion_signal, tracking_not_stopped, sleep_score, sleep_quality)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sleep_start             = VALUES(sleep_start),
         wake_time               = VALUES(wake_time),
         duration_minutes        = VALUES(duration_minutes),
         time_in_bed_minutes     = VALUES(time_in_bed_minutes),
         timezone_offset_minutes = VALUES(timezone_offset_minutes),
         source                  = VALUES(source),
         source_name             = VALUES(source_name),
         confidence              = VALUES(confidence),
         efficiency_percent      = VALUES(efficiency_percent),
         awakenings              = VALUES(awakenings),
         sleep_latency_minutes   = VALUES(sleep_latency_minutes),
         disturbances            = VALUES(disturbances),
         stage_awake             = VALUES(stage_awake),
         stage_light             = VALUES(stage_light),
         stage_deep              = VALUES(stage_deep),
         stage_rem               = VALUES(stage_rem),
         stage_asleep            = VALUES(stage_asleep),
         low_motion_signal       = VALUES(low_motion_signal),
         tracking_not_stopped    = VALUES(tracking_not_stopped),
         sleep_score             = VALUES(sleep_score),
         sleep_quality           = VALUES(sleep_quality)`,
      [
        patientId,
        n.date,
        n.sleepStart  || null,
        n.wakeTime    || null,
        n.durationMinutes       ?? null,
        n.timeInBedMinutes      ?? null,
        timezoneOffsetMinutes   ?? null,
        n.source      || null,
        n.sourceName  || null,
        n.confidence  ?? null,
        n.efficiencyPercent     ?? null,
        n.awakenings  ?? null,
        n.sleepLatencyMinutes   ?? null,
        n.disturbances ?? null,
        stages.awake  ?? null,
        stages.light  ?? null,
        stages.deep   ?? null,
        stages.rem    ?? null,
        stages.asleep ?? null,
        n.lowMotionSignal    ? 1 : 0,
        n.trackingNotStopped ? 1 : 0,
        n.sleepScore  ?? null,
        n.sleepQuality || null,
      ]
    );
  }

  // Delete specified dates
  if (deletedDates.length > 0) {
    await db.query(
      `DELETE FROM app_sleep_logs WHERE app_user_id = ? AND date IN (?)`,
      [patientId, deletedDates]
    );
  }

  return { success: true };
};

// ─── DELETE /sleep/sync ───────────────────────────────────────────────────────
const deleteAllSleep = async (patientId) => {
  await db.query(`DELETE FROM app_sleep_logs WHERE app_user_id = ?`, [patientId]);
  return { success: true };
};

// ─── GET /sleep/nights ────────────────────────────────────────────────────────
const getSleepNights = async (patientId, { from, to }) => {
  const [rows] = await db.query(
    `SELECT * FROM app_sleep_logs
     WHERE app_user_id = ?
       AND date BETWEEN ? AND ?
     ORDER BY date ASC`,
    [patientId, from, to]
  );
  return { nights: rows.map(formatNight) };
};

module.exports = { syncSleep, deleteAllSleep, getSleepNights };
