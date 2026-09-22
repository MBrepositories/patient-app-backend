const db = require('../config/db');
const { generateReply } = require('./chat.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTimeLabel = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
  const timeLabel = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return isToday ? timeLabel : `${dayLabel}, ${timeLabel}`;
};

// Get assigned doctor — stored doctor first, then branch Clinic Head
const getAssignedDoctor = async (patientId) => {
  // 1. Stored doctor_id on the latest active care plan enrollment
  const [[careplanRow]] = await db.query(
    `SELECT u.name, u.id,
            COALESCE(u.specialization, 'General Physician') AS specialty
     FROM app_patient_careplans apc
     INNER JOIN users u ON u.id = apc.doctor_id AND u.status = 'active'
     WHERE apc.app_user_id = ? AND apc.status = 'active' AND apc.doctor_id IS NOT NULL
     ORDER BY apc.created_at DESC LIMIT 1`,
    [patientId]
  );
  if (careplanRow) return careplanRow;

  // 2. Backfill: branch Clinic Head (clinic_head = 1)
  const [[clinicHeadRow]] = await db.query(
    `SELECT u.name, u.id,
            COALESCE(u.specialization, 'General Physician') AS specialty
     FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id AND u.status = 'active' AND u.clinic_head = 1
     WHERE p.id = ?
     LIMIT 1`,
    [patientId]
  );
  if (clinicHeadRow) return clinicHeadRow;

  // 3. Last resort: any active doctor in the branch
  const [[branchRow]] = await db.query(
    `SELECT u.name, u.id,
            COALESCE(u.specialization, 'General Physician') AS specialty
     FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id AND u.role = 'doctor' AND u.status = 'active'
     WHERE p.id = ?
     ORDER BY u.id ASC LIMIT 1`,
    [patientId]
  );
  return branchRow || null;
};

// Get patient name
const getPatientName = async (patientId) => {
  const [[row]] = await db.query(
    `SELECT patient_name FROM patients WHERE id = ? LIMIT 1`,
    [patientId]
  );
  return row?.patient_name || 'Patient';
};

// ─── GET chat history ─────────────────────────────────────────────────────────

const getChatHistory = async (patientId) => {
  const [doctor, patientName] = await Promise.all([
    getAssignedDoctor(patientId),
    getPatientName(patientId),
  ]);

  const doctorName    = doctor ? doctor.name : 'Your Doctor';
  const doctorInitials = doctorName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const doctorSpecialty = doctor?.specialty || 'General Physician';

  // Mark doctor/ai messages as read (patient is opening the chat)
  await db.query(
    `UPDATE app_chat_messages SET status = 'read'
     WHERE patient_id = ? AND sender IN ('doctor', 'ai') AND status != 'read'`,
    [patientId]
  );

  // Messages from app_chat_messages (patient/doctor/ai senders only)
  const [msgRows] = await db.query(
    `SELECT id, sender, sender_name, text, status, created_at
     FROM app_chat_messages
     WHERE patient_id = ? AND sender IN ('patient', 'doctor', 'ai')
     ORDER BY created_at ASC`,
    [patientId]
  );

  const messageItems = msgRows.map(r => ({
    kind:       'message',
    id:         `msg-${r.id}`,
    sender:     r.sender,
    senderName: r.sender_name || (r.sender === 'patient' ? patientName : r.sender === 'doctor' ? doctorName : 'AiSHA AI'),
    text:       r.text,
    status:     r.status || 'delivered',
    timeLabel:  formatTimeLabel(r.created_at),
    _sortAt:    new Date(r.created_at).getTime(),
  }));

  // Activity items — vitals (last 30 days)
  const [vitalRows] = await db.query(
    `SELECT type, value, logged_at FROM app_vitals
     WHERE app_user_id = ? AND logged_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY logged_at ASC`,
    [patientId]
  );

  const vitalItems = vitalRows.map((r, i) => ({
    kind:      'activity',
    id:        `activity-vitals-${i}`,
    type:      'vitals',
    summary:   `Logged ${r.type.charAt(0).toUpperCase() + r.type.slice(1)}: ${r.value}`,
    timeLabel: formatTimeLabel(r.logged_at),
    _sortAt:   new Date(r.logged_at).getTime(),
  }));

  // Activity items — meals (last 30 days)
  const [mealRows] = await db.query(
    `SELECT meal_period, logged_at FROM app_meal_logs
     WHERE patient_id = ? AND logged_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY logged_at ASC`,
    [patientId]
  );

  const mealItems = mealRows.map((r, i) => ({
    kind:      'activity',
    id:        `activity-meal-${i}`,
    type:      'meal',
    summary:   `Logged ${r.meal_period.charAt(0).toUpperCase() + r.meal_period.slice(1)} meal`,
    timeLabel: formatTimeLabel(r.logged_at),
    _sortAt:   new Date(r.logged_at).getTime(),
  }));

  // Activity items — exercise (last 30 days)
  const [exRows] = await db.query(
    `SELECT exercise_key, compliance_status, created_at FROM app_exercise_sessions
     WHERE app_user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY created_at ASC`,
    [patientId]
  );

  const exerciseItems = exRows.map((r, i) => {
    const key = r.exercise_key ? String(r.exercise_key).slice(0, 50) : null;
    return {
      kind:      'activity',
      id:        `activity-exercise-${i}`,
      type:      'exercise',
      summary:   `Exercise session ${r.compliance_status || 'completed'}${key ? ` — ${key}` : ''}`,
      timeLabel: formatTimeLabel(r.created_at),
      _sortAt:   new Date(r.created_at).getTime(),
    };
  });

  // Activity items — dose changes by doctor (last 30 days)
  const [doseRows] = await db.query(
    `SELECT id, medicine_name, morning, afternoon, night, sos, created_at
     FROM app_dose_changes
     WHERE patient_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY created_at ASC`,
    [patientId]
  );

  const doseItems = doseRows.map(r => {
    const parts = [];
    if (Number(r.morning))   parts.push(`Morning: ${r.morning}`);
    if (Number(r.afternoon)) parts.push(`Afternoon: ${r.afternoon}`);
    if (Number(r.night))     parts.push(`Night: ${r.night}`);
    if (Number(r.sos))       parts.push('SOS');
    const dosageLabel = parts.length ? ` (${parts.join(', ')})` : '';
    return {
      kind:      'activity',
      id:        `activity-dose-${r.id}`,
      type:      'doseChange',
      summary:   `Doctor updated ${r.medicine_name} dosage${dosageLabel}`,
      timeLabel: formatTimeLabel(r.created_at),
      _sortAt:   new Date(r.created_at).getTime(),
    };
  });

  // Merge all items and sort oldest → newest
  const items = [...messageItems, ...vitalItems, ...mealItems, ...exerciseItems, ...doseItems]
    .sort((a, b) => a._sortAt - b._sortAt)
    .map(({ _sortAt, ...item }) => item);

  return {
    doctorName,
    doctorSpecialty,
    doctorInitials,
    items,
  };
};

// ─── POST — save patient message + AI reply ───────────────────────────────────

const sendMessage = async (patientId, text) => {
  const [doctor, patientName] = await Promise.all([
    getAssignedDoctor(patientId),
    getPatientName(patientId),
  ]);

  const doctorName = doctor ? doctor.name : 'Your Doctor';

  // Save patient message
  await db.query(
    `INSERT INTO app_chat_messages (patient_id, sender, sender_name, text) VALUES (?, 'patient', ?, ?)`,
    [patientId, patientName, text]
  );

  // Generate AI reply — AI does not speak in doctor's name
  const replyText = await generateReply(patientId, text);
  const aiReply = replyText;

  const [result] = await db.query(
    `INSERT INTO app_chat_messages (patient_id, sender, sender_name, text) VALUES (?, 'ai', 'AiSHA AI', ?)`,
    [patientId, aiReply]
  );

  return {
    kind:       'message',
    id:         `msg-${result.insertId}`,
    sender:     'ai',
    senderName: 'AiSHA AI',
    text:       aiReply,
    status:     'delivered',
    timeLabel:  formatTimeLabel(new Date()),
  };
};

// ─── Doctor: GET chat history with a patient ──────────────────────────────────

const getDoctorChatHistory = async (doctorId, patientId) => {
  // Verify doctor has access to this patient (branch-based)
  const [[assigned]] = await db.query(
    `SELECT p.id FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id
     WHERE p.id = ? AND u.id = ? AND p.status = 'active'
     LIMIT 1`,
    [patientId, doctorId]
  );
  if (!assigned) {
    const err = new Error('Patient not assigned to this doctor');
    err.statusCode = 403;
    throw err;
  }

  const [[doctorRow]] = await db.query(
    `SELECT name, COALESCE(specialization, 'General Physician') AS specialty FROM users WHERE id = ? LIMIT 1`,
    [doctorId]
  );
  const doctorName = doctorRow?.name || 'Doctor';

  const patientName = await getPatientName(patientId);

  // Mark patient messages as read (doctor is opening the chat)
  await db.query(
    `UPDATE app_chat_messages SET status = 'read'
     WHERE patient_id = ? AND sender = 'patient' AND status != 'read'`,
    [patientId]
  );

  // Fetch messages
  const [msgRows] = await db.query(
    `SELECT id, sender, sender_name, text, status, created_at
     FROM app_chat_messages
     WHERE patient_id = ? AND sender IN ('patient', 'doctor', 'ai')
     ORDER BY created_at ASC`,
    [patientId]
  );

  const messageItems = msgRows.map(r => ({
    kind:       'message',
    id:         `msg-${r.id}`,
    sender:     r.sender,
    senderName: r.sender_name || (r.sender === 'patient' ? patientName : r.sender === 'doctor' ? doctorName : 'AiSHA AI'),
    text:       r.text,
    status:     r.status || 'delivered',
    timeLabel:  formatTimeLabel(r.created_at),
    _sortAt:    new Date(r.created_at).getTime(),
  }));

  // Dose change activities (last 30 days)
  const [doseRows] = await db.query(
    `SELECT id, medicine_name, morning, afternoon, night, sos, created_at
     FROM app_dose_changes
     WHERE patient_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     ORDER BY created_at ASC`,
    [patientId]
  );

  const doseItems = doseRows.map(r => {
    const parts = [];
    if (Number(r.morning))   parts.push(`Morning: ${r.morning}`);
    if (Number(r.afternoon)) parts.push(`Afternoon: ${r.afternoon}`);
    if (Number(r.night))     parts.push(`Night: ${r.night}`);
    if (Number(r.sos))       parts.push('SOS');
    const dosageLabel = parts.length ? ` (${parts.join(', ')})` : '';
    return {
      kind:      'activity',
      id:        `activity-dose-${r.id}`,
      type:      'doseChange',
      summary:   `Doctor updated ${r.medicine_name} dosage${dosageLabel}`,
      timeLabel: formatTimeLabel(r.created_at),
      _sortAt:   new Date(r.created_at).getTime(),
    };
  });

  const items = [...messageItems, ...doseItems]
    .sort((a, b) => a._sortAt - b._sortAt)
    .map(({ _sortAt, ...item }) => item);

  return {
    patientName,
    patientInitials: patientName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
    items,
  };
};

// ─── Doctor: POST — send message to patient ───────────────────────────────────

const sendDoctorMessage = async (doctorId, patientId, text) => {
  // Verify access
  const [[assigned]] = await db.query(
    `SELECT p.id FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id
     WHERE p.id = ? AND u.id = ? AND p.status = 'active'
     LIMIT 1`,
    [patientId, doctorId]
  );
  if (!assigned) {
    const err = new Error('Patient not assigned to this doctor');
    err.statusCode = 403;
    throw err;
  }

  const [[doctorRow]] = await db.query(
    `SELECT name FROM users WHERE id = ? LIMIT 1`,
    [doctorId]
  );
  const doctorName = doctorRow?.name || 'Doctor';

  const [result] = await db.query(
    `INSERT INTO app_chat_messages (patient_id, sender, sender_name, text, status)
     VALUES (?, 'doctor', ?, ?, 'delivered')`,
    [patientId, doctorName, text]
  );

  return {
    kind:       'message',
    id:         `msg-${result.insertId}`,
    sender:     'doctor',
    senderName: doctorName,
    text,
    status:     'delivered',
    timeLabel:  formatTimeLabel(new Date()),
  };
};

module.exports = { getChatHistory, sendMessage, getDoctorChatHistory, sendDoctorMessage };
