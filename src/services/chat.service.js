const db = require('../config/db');

const getChatWelcome = () => {
  return {
    assistantName: 'Aisha AI',
    assistantStatus: 'Online Now',
    welcomeMessage: 'Welcome to Madhavbaug! I\'m Aisha, your personal health companion. I\'m here to help you track your health, answer your questions, and support your wellness journey.',
    quickActions: [
      { id: 'log-vitals', iconName: 'monitor-heart', iconColor: '#E63950', iconBackground: '#E639501A', label: 'Log Vitals' },
      { id: 'log-meal', iconName: 'restaurant', iconColor: '#4C6FFF', iconBackground: '#4C6FFF1A', label: 'Log Meal' },
      { id: 'view-medicines', iconName: 'medical-services', iconColor: '#27AE60', iconBackground: '#27AE601A', label: 'My Medicines' },
    ],
    suggestedPrompts: [
      { id: 'suggested-bp', text: 'How was my BP yesterday?' },
      { id: 'suggested-medicine', text: 'What medicines do I need to take today?' },
      { id: 'suggested-diet', text: 'What should I eat for breakfast?' },
    ],
  };
};

const formatDate = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
};

const detect = (text) => {
  const t = text.toLowerCase();
  if (/\b(bp|blood\s*pressure|systolic|diastolic)\b/.test(t)) return 'bp';
  if (/\b(sugar|glucose|blood\s*sugar|hba1c)\b/.test(t)) return 'sugar';
  if (/\b(weight|kg|kilogram)\b/.test(t)) return 'weight';
  if (/\b(waist|waistline)\b/.test(t)) return 'waist';
  if (/\b(step|walk|walked|walking)\b/.test(t)) return 'steps';
  if (/\b(medicine|medication|dose|tablet|pill)\b/.test(t)) return 'medicines';
  if (/\b(appointment|visit|next\s*appointment)\b/.test(t)) return 'appointment';
  if (/\b(exercise|workout|gym|session)\b/.test(t)) return 'exercise';
  if (/\b(meal|food|diet|eat|breakfast|lunch|dinner|snack)\b/.test(t)) return 'diet';
  if (/\b(points|reward|score)\b/.test(t)) return 'points';
  if (/\b(streak)\b/.test(t)) return 'streak';
  if (/\b(vital|vitals)\b/.test(t)) return 'vitals-summary';
  if (/\b(fever|cold|cough|pain|headache|dizzy|nausea|vomit|sick|ill|symptom)\b/.test(t)) return 'symptom';
  if (/\b(hello|hi|good\s*morning|good\s*evening|good\s*afternoon)\b/.test(t)) return 'greeting';
  return 'unknown';
};

// patientId = hospital patient ID (from JWT), patientId = app_users.id
// patientId = patients.id — same value used as app_user_id in app_* tables
//             and as patient_id in hospital tables (patient_vitals, appointments, etc.)
const generateReply = async (patientId, text) => {
  const intent = detect(text);

  if (intent === 'bp') {
    // BP is in hospital patient_vitals table
    const [rows] = await db.query(
      `SELECT blood_pressure_systolic, blood_pressure_diastolic,
              DATE_FORMAT(COALESCE(vitals_recorded_at, recorded_at, created_at), '%W, %e %b') AS date_label
       FROM patient_vitals
       WHERE patient_id = ? AND blood_pressure_systolic IS NOT NULL AND blood_pressure_systolic != ''
       ORDER BY COALESCE(vitals_recorded_at, recorded_at, created_at) DESC LIMIT 1`,
      [patientId]
    );
    if (rows.length) {
      const r = rows[0];
      const dateStr = r.date_label ? ` on ${r.date_label}` : '';
      return `Your last recorded blood pressure was ${r.blood_pressure_systolic}/${r.blood_pressure_diastolic} mmHg${dateStr}. Keep monitoring it regularly.`;
    }
    return "I don't have any blood pressure records for you yet. Please log your vitals to get started.";
  }

  if (intent === 'sugar') {
    const [rows] = await db.query(
      `SELECT blood_sugar_fasting, blood_sugar_postprandial, blood_sugar_random, blood_sugar_hba1c,
              DATE_FORMAT(COALESCE(vitals_recorded_at, recorded_at, created_at), '%W, %e %b') AS date_label
       FROM patient_vitals
       WHERE patient_id = ? AND (blood_sugar_fasting IS NOT NULL OR blood_sugar_hba1c IS NOT NULL)
       ORDER BY COALESCE(vitals_recorded_at, recorded_at, created_at) DESC LIMIT 1`,
      [patientId]
    );
    if (rows.length) {
      const r = rows[0];
      const val = r.blood_sugar_fasting || r.blood_sugar_postprandial || r.blood_sugar_random;
      const hba1c = r.blood_sugar_hba1c;
      let msg = r.date_label ? `On ${r.date_label}: ` : 'Your latest reading: ';
      if (val) msg += `blood sugar ${val} mg/dL`;
      if (hba1c) msg += (val ? ', ' : '') + `HbA1c ${hba1c}%`;
      return msg + '.';
    }
    return "I don't have any blood sugar records for you yet. Please log your vitals.";
  }

  if (intent === 'weight') {
    // Check app_vitals first (patient-logged), then patient_vitals
    const [appRows] = await db.query(
      `SELECT value, logged_at FROM app_vitals WHERE app_user_id = ? AND type = 'weight' ORDER BY logged_at DESC LIMIT 1`,
      [patientId]
    );
    if (appRows.length) {
      return `Your last recorded weight was ${appRows[0].value} kg on ${formatDate(appRows[0].logged_at)}.`;
    }
    const [hvRows] = await db.query(
      `SELECT weight, DATE_FORMAT(COALESCE(vitals_recorded_at, recorded_at, created_at), '%W, %e %b') AS date_label FROM patient_vitals WHERE patient_id = ? AND weight IS NOT NULL AND weight != '' ORDER BY COALESCE(vitals_recorded_at, recorded_at, created_at) DESC LIMIT 1`,
      [patientId]
    );
    if (hvRows.length) {
      return `Your last recorded weight was ${hvRows[0].weight} kg${hvRows[0].date_label ? ` on ${hvRows[0].date_label}` : ''}.`;
    }
    return "I don't have any weight records for you yet. Please log your vitals.";
  }

  if (intent === 'waist') {
    const [appRows] = await db.query(
      `SELECT value, logged_at FROM app_vitals WHERE app_user_id = ? AND type = 'waist' ORDER BY logged_at DESC LIMIT 1`,
      [patientId]
    );
    if (appRows.length) {
      return `Your last recorded waist measurement was ${appRows[0].value} cm on ${formatDate(appRows[0].logged_at)}.`;
    }
    return "I don't have any waist measurement records yet. Please log your vitals.";
  }

  if (intent === 'steps') {
    const [rows] = await db.query(
      `SELECT steps FROM app_steps_log WHERE app_user_id = ? AND DATE(logged_at) = CURDATE() ORDER BY logged_at DESC LIMIT 1`,
      [patientId]
    );
    if (rows.length) {
      return `You've walked ${Number(rows[0].steps).toLocaleString()} steps today. Keep it up!`;
    }
    return "No steps recorded for today yet. Start walking and your steps will sync automatically.";
  }

  if (intent === 'medicines') {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS taken FROM app_medicine_logs WHERE app_user_id = ? AND DATE(logged_at) = CURDATE() AND taken = 1`,
      [patientId]
    );
    const taken = rows[0]?.taken || 0;
    if (taken > 0) {
      return `You've marked ${taken} dose(s) as taken today. Keep up with your medication schedule.`;
    }
    return "No medicine doses marked for today yet. Please log your doses in the Medicines section.";
  }

  if (intent === 'appointment') {
    const [rows] = await db.query(
      `SELECT a.appointment_date, a.appointment_time, u.name AS doctor_name
       FROM appointments a
       LEFT JOIN users u ON u.id = a.doctor_id
       WHERE a.patient_id = ? AND a.appointment_date >= CURDATE() AND a.status NOT IN ('cancelled','no-show')
       ORDER BY a.appointment_date ASC, a.appointment_time ASC LIMIT 1`,
      [patientId]
    );
    if (rows.length) {
      const r = rows[0];
      const dateLabel = formatDate(r.appointment_date);
      const time = r.appointment_time ? String(r.appointment_time).slice(0, 5) : '';
      const doctor = r.doctor_name ? ` with ${r.doctor_name}` : '';
      return `Your next appointment is on ${dateLabel} at ${time}${doctor}. Please carry your latest reports.`;
    }
    return "You don't have any upcoming appointments. You can book one from the Appointments section.";
  }

  if (intent === 'exercise') {
    const [rows] = await db.query(
      `SELECT exercise_key, duration_seconds, completed_at FROM app_exercise_sessions
       WHERE app_user_id = ? ORDER BY completed_at DESC LIMIT 1`,
      [patientId]
    );
    if (rows.length) {
      const r = rows[0];
      const mins = Math.round((r.duration_seconds || 0) / 60);
      return `Your last exercise session was on ${formatDate(r.completed_at)}${mins ? ` for ${mins} minutes` : ''}. Great work staying active!`;
    }
    return "No exercise sessions recorded yet. Start your program from the Exercise tab.";
  }

  if (intent === 'diet') {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS meals FROM app_meal_logs WHERE patient_id = ? AND DATE(logged_at) = CURDATE()`,
      [patientId]
    );
    const meals = Number(rows[0]?.meals || 0);
    if (meals > 0) {
      return `You've logged ${meals} meal(s) today. Keep maintaining a healthy diet!`;
    }
    return "No meals logged for today yet. Remember to log your meals in the Diet section.";
  }

  if (intent === 'points') {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(points), 0) AS total FROM app_reward_points WHERE app_user_id = ?`,
      [patientId]
    );
    return `You have ${rows[0]?.total || 0} reward points. Keep logging daily activities to earn more!`;
  }

  if (intent === 'streak') {
    return "Your streak is tracked based on daily activity logging. Keep logging vitals, meals, and exercise every day to build your streak!";
  }

  if (intent === 'vitals-summary') {
    return "You can log your vitals — weight, HbA1c, LDL, and waist — from the Vitals section. Your doctor will be able to see your latest readings. Would you like a summary of your recent vitals?";
  }

  if (intent === 'symptom') {
    return "I've noted your concern. If this is an emergency, please contact your nearest hospital immediately.";
  }

  if (intent === 'greeting') {
    return "Hello! I'm AiSHA, your personal health assistant. How can I help you today? You can ask me about your vitals, medicines, appointments, diet, or exercise.";
  }

  return "I've received your message and your doctor will follow up shortly. You can also ask me about your blood pressure, sugar levels, weight, steps, medicines, appointments, exercise, or diet.";
};

const sendMessage = async (patientId, text) => {
  await db.query(
    'INSERT INTO app_chat_messages (patient_id, sender, text) VALUES (?, ?, ?)',
    [patientId, 'user', text]
  );

  const replyText = await generateReply(patientId, text);

  const [assistantResult] = await db.query(
    'INSERT INTO app_chat_messages (patient_id, sender, text) VALUES (?, ?, ?)',
    [patientId, 'assistant', replyText]
  );

  return {
    id: `assistant-${assistantResult.insertId}`,
    sender: 'assistant',
    text: replyText,
  };
};

module.exports = { getChatWelcome, sendMessage, generateReply };
