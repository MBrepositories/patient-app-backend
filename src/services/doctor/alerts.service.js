const db = require('../../config/db');

const SYMPTOM_KEYWORDS = /\b(fever|cold|cough|pain|headache|dizzy|nausea|vomit|sick|ill|symptom|chest|breathless|bleeding|faint|unconscious)\b/i;

const getAlerts = async (doctorId) => {
  // Get all active patients in doctor's branch
  const [patients] = await db.query(
    `SELECT p.id, p.patient_name
     FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id AND u.id = ?
     WHERE p.status = 'active' AND p.app_password IS NOT NULL
     ORDER BY p.patient_name ASC`,
    [doctorId]
  );

  if (!patients.length) return { alerts: [], totalCount: 0 };

  const patientIds = patients.map(p => p.id);
  const patientMap = {};
  patients.forEach(p => { patientMap[p.id] = p.patient_name; });

  const now = new Date().toISOString();
  const alerts = [];

  // ── 1. Missed Medicine ────────────────────────────────────────────────────────
  const [missedMedRows] = await db.query(
    `SELECT DISTINCT p.id AS patient_id
     FROM patients p
     WHERE p.id IN (?)
       AND (
         EXISTS (SELECT 1 FROM patient_madhavbaug pm INNER JOIN appointments a ON a.id = pm.appointment_id WHERE a.patient_id = p.id LIMIT 1)
         OR
         EXISTS (SELECT 1 FROM patient_allopathy pa INNER JOIN appointments a ON a.id = pa.appointment_id WHERE a.patient_id = p.id AND pa.notonmedicine = 0 LIMIT 1)
       )
       AND p.id NOT IN (
         SELECT DISTINCT app_user_id FROM app_medicine_logs
         WHERE DATE(logged_at) = CURDATE() AND taken = 1
       )`,
    [patientIds]
  );
  missedMedRows.forEach(r => {
    alerts.push({
      patientId:   `patient-${r.patient_id}`,
      patientDbId: r.patient_id,
      patientName: patientMap[r.patient_id],
      type:        'missedMedicine',
      message:     'No medicine logged today',
      severity:    'warning',
      timestamp:   now,
    });
  });

  // ── 2. Missed Exercise ────────────────────────────────────────────────────────
  const [missedExRows] = await db.query(
    `SELECT DISTINCT apc.app_user_id AS patient_id
     FROM app_patient_careplans apc
     WHERE apc.app_user_id IN (?) AND apc.status = 'active'
       AND apc.app_user_id NOT IN (
         SELECT DISTINCT app_user_id FROM app_exercise_sessions
         WHERE DATE(created_at) = CURDATE()
       )`,
    [patientIds]
  );
  missedExRows.forEach(r => {
    alerts.push({
      patientId:   `patient-${r.patient_id}`,
      patientDbId: r.patient_id,
      patientName: patientMap[r.patient_id],
      type:        'missedExercise',
      message:     'No exercise session completed today',
      severity:    'warning',
      timestamp:   now,
    });
  });

  // ── 3. Missed Diet ────────────────────────────────────────────────────────────
  const [loggedDietRows] = await db.query(
    `SELECT DISTINCT patient_id FROM app_meal_logs WHERE DATE(logged_at) = CURDATE() AND patient_id IN (?)`,
    [patientIds]
  );
  const loggedDietIds = new Set(loggedDietRows.map(r => r.patient_id));
  patientIds.forEach(id => {
    if (!loggedDietIds.has(id)) {
      alerts.push({
        patientId:   `patient-${id}`,
        patientDbId: id,
        patientName: patientMap[id],
        type:        'missedDiet',
        message:     'No meals logged today',
        severity:    'warning',
        timestamp:   now,
      });
    }
  });

  // ── 4. No Activity ────────────────────────────────────────────────────────────
  const [activeVitals] = await db.query(
    `SELECT DISTINCT app_user_id AS id FROM app_vitals WHERE DATE(logged_at) = CURDATE() AND app_user_id IN (?)`,
    [patientIds]
  );
  const [activeMeals] = await db.query(
    `SELECT DISTINCT patient_id AS id FROM app_meal_logs WHERE DATE(logged_at) = CURDATE() AND patient_id IN (?)`,
    [patientIds]
  );
  const [activeSteps] = await db.query(
    `SELECT DISTINCT app_user_id AS id FROM app_steps_log
     WHERE (date = CURDATE() OR DATE(logged_at) = CURDATE()) AND app_user_id IN (?)`,
    [patientIds]
  );
  const [activeEx] = await db.query(
    `SELECT DISTINCT app_user_id AS id FROM app_exercise_sessions WHERE DATE(created_at) = CURDATE() AND app_user_id IN (?)`,
    [patientIds]
  );

  const activeIds = new Set([
    ...activeVitals.map(r => r.id),
    ...activeMeals.map(r => r.id),
    ...activeSteps.map(r => r.id),
    ...activeEx.map(r => r.id),
  ]);

  patientIds.forEach(id => {
    if (!activeIds.has(id)) {
      alerts.push({
        patientId:   `patient-${id}`,
        patientDbId: id,
        patientName: patientMap[id],
        type:        'noActivity',
        message:     'No activity logged today',
        severity:    'critical',
        timestamp:   now,
      });
    }
  });

  // ── 5. Emergency Symptoms ─────────────────────────────────────────────────────
  const [symptomRows] = await db.query(
    `SELECT patient_id, text, created_at
     FROM app_chat_messages
     WHERE patient_id IN (?) AND sender = 'patient'
       AND DATE(created_at) = CURDATE()
     ORDER BY created_at DESC`,
    [patientIds]
  );

  const symptomSeen = new Set();
  symptomRows.forEach(r => {
    if (!symptomSeen.has(r.patient_id) && SYMPTOM_KEYWORDS.test(r.text)) {
      symptomSeen.add(r.patient_id);
      alerts.push({
        patientId:   `patient-${r.patient_id}`,
        patientDbId: r.patient_id,
        patientName: patientMap[r.patient_id],
        type:        'emergencySymptom',
        message:     `Patient reported: "${r.text.slice(0, 80)}"`,
        severity:    'critical',
        timestamp:   new Date(r.created_at).toISOString(),
      });
    }
  });

  // Sort: critical first, then warning
  alerts.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'critical' ? -1 : 1;
  });

  return { alerts, totalCount: alerts.length };
};

module.exports = { getAlerts };
