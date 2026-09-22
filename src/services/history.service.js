const db = require('../config/db');

const CATEGORIES = [
  { id: 'medical',  label: 'Medical',   iconName: 'medical-services' },
  { id: 'booking',  label: 'Bookings',  iconName: 'event-available' },
  { id: 'vitals',   label: 'Vitals',    iconName: 'monitor-heart' },
  { id: 'diet',     label: 'Diet',      iconName: 'restaurant' },
  { id: 'exercise', label: 'Exercise',  iconName: 'fitness-center' },
];

// Format JS Date → YYYY-MM-DD string
const toIsoDate = (d) => {
  if (!d || d instanceof Date && isNaN(d)) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const VITAL_LABELS = {
  weight: 'Weight',
  hba1c:  'HbA1c',
  ldl:    'LDL Cholesterol',
  waist:  'Waist',
};

const VITAL_UNITS = {
  weight: 'kg',
  hba1c:  '%',
  ldl:    'mg/dL',
  waist:  'cm',
};

// Determine statusTone for a vital type+value
const vitalTone = (type, value) => {
  const v = parseFloat(value);
  if (isNaN(v)) return 'neutral';
  if (type === 'weight') return v > 90 ? 'warning' : 'good';
  if (type === 'hba1c')  return v >= 6.5 ? 'bad' : v >= 5.7 ? 'warning' : 'good';
  if (type === 'ldl')    return v >= 160 ? 'bad' : v >= 130 ? 'warning' : 'good';
  if (type === 'waist')  return v >= 102 ? 'bad' : v >= 90 ? 'warning' : 'good';
  return 'neutral';
};

const getHistory = async (patientId) => {
  const [vitalsRows, bookingRows, dietRows, exerciseRows, medicalRows] = await Promise.all([

    // VITALS — patient-logged via app
    db.query(
      `SELECT id, type, value, DATE_FORMAT(logged_at, '%Y-%m-%d') AS iso_date
       FROM app_vitals WHERE app_user_id = ?
       ORDER BY logged_at DESC`,
      [patientId]
    ),

    // BOOKINGS — from appointments table
    db.query(
      `SELECT a.id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS iso_date,
              a.appointment_time, a.status, a.chief_complaint,
              u.name AS doctor_name
       FROM appointments a
       LEFT JOIN users u ON u.id = a.doctor_id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC`,
      [patientId]
    ),

    // DIET — meal logs
    db.query(
      `SELECT id, meal_period, estimated_calories,
              DATE_FORMAT(logged_at, '%Y-%m-%d') AS iso_date
       FROM app_meal_logs WHERE patient_id = ?
       ORDER BY logged_at DESC`,
      [patientId]
    ),

    // EXERCISE — camera sessions
    db.query(
      `SELECT id, exercise_key, compliance_status,
              DATE_FORMAT(completed_at, '%Y-%m-%d') AS iso_date
       FROM app_exercise_sessions WHERE app_user_id = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC`,
      [patientId]
    ),

    // MEDICAL — hospital vitals (BP, sugar) as medical records
    db.query(
      `SELECT id,
              blood_pressure_systolic, blood_pressure_diastolic,
              blood_sugar_fasting, blood_sugar_hba1c,
              DATE_FORMAT(COALESCE(vitals_recorded_at, recorded_at, created_at), '%Y-%m-%d') AS iso_date
       FROM patient_vitals
       WHERE patient_id = ?
         AND (blood_pressure_systolic IS NOT NULL OR blood_sugar_fasting IS NOT NULL)
       ORDER BY COALESCE(vitals_recorded_at, recorded_at, created_at) DESC`,
      [patientId]
    ),
  ]);

  const records = [];

  // ── VITALS ──────────────────────────────────────────────────────────────────
  for (const r of vitalsRows[0]) {
    if (!r.iso_date) continue;
    const label = VITAL_LABELS[r.type] || r.type;
    const unit  = VITAL_UNITS[r.type] || '';
    records.push({
      id:          `vitals-${r.id}`,
      categoryId:  'vitals',
      title:       label,
      subtitle:    `${r.value} ${unit}`.trim(),
      isoDate:     r.iso_date,
      statusLabel: 'Logged',
      statusTone:  vitalTone(r.type, r.value),
    });
  }

  // ── BOOKINGS ─────────────────────────────────────────────────────────────────
  const statusToneMap = {
    confirmed:   'good',
    completed:   'good',
    pending:     'neutral',
    cancelled:   'bad',
    rescheduled: 'warning',
    'no-show':   'bad',
  };
  for (const r of bookingRows[0]) {
    if (!r.iso_date) continue;
    const doctor  = r.doctor_name ? `Dr. ${r.doctor_name.replace(/^dr\.?\s*/i, '')}` : 'Doctor';
    const complaint = r.chief_complaint ? ` — ${r.chief_complaint}` : '';
    records.push({
      id:          `booking-${r.id}`,
      categoryId:  'booking',
      title:       `Appointment with ${doctor}`,
      subtitle:    `${r.status.charAt(0).toUpperCase() + r.status.slice(1)}${complaint}`,
      isoDate:     r.iso_date,
      statusLabel: r.status.charAt(0).toUpperCase() + r.status.slice(1),
      statusTone:  statusToneMap[r.status] || 'neutral',
    });
  }

  // ── DIET ─────────────────────────────────────────────────────────────────────
  const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  for (const r of dietRows[0]) {
    if (!r.iso_date) continue;
    records.push({
      id:          `diet-${r.id}`,
      categoryId:  'diet',
      title:       mealLabels[r.meal_period] || 'Meal',
      subtitle:    r.estimated_calories ? `${r.estimated_calories} kcal` : 'Logged',
      isoDate:     r.iso_date,
      statusLabel: 'Logged',
      statusTone:  'good',
    });
  }

  // ── EXERCISE ─────────────────────────────────────────────────────────────────
  const exerciseTone = { completed: 'good', partial: 'warning', missed: 'bad' };
  const exerciseLabels = {
    squat:               'Squat',
    chairExercise:       'Chair Exercise',
    standingSideStretch: 'Standing Side Stretch',
  };
  for (const r of exerciseRows[0]) {
    if (!r.iso_date) continue;
    records.push({
      id:          `exercise-${r.id}`,
      categoryId:  'exercise',
      title:       exerciseLabels[r.exercise_key] || 'Exercise Session',
      subtitle:    r.compliance_status ? r.compliance_status.charAt(0).toUpperCase() + r.compliance_status.slice(1) : 'Logged',
      isoDate:     r.iso_date,
      statusLabel: r.compliance_status ? r.compliance_status.charAt(0).toUpperCase() + r.compliance_status.slice(1) : 'Logged',
      statusTone:  exerciseTone[r.compliance_status] || 'neutral',
    });
  }

  // ── MEDICAL (hospital vitals) ─────────────────────────────────────────────
  for (const r of medicalRows[0]) {
    if (!r.iso_date) continue;
    if (r.blood_pressure_systolic) {
      const sys = r.blood_pressure_systolic;
      const dia = r.blood_pressure_diastolic || '?';
      const tone = parseInt(sys) >= 160 ? 'bad' : parseInt(sys) >= 140 ? 'warning' : 'good';
      records.push({
        id:          `medical-bp-${r.id}`,
        categoryId:  'medical',
        title:       'Blood Pressure',
        subtitle:    `${sys}/${dia} mmHg`,
        isoDate:     r.iso_date,
        statusLabel: parseInt(sys) >= 160 ? 'High' : parseInt(sys) >= 140 ? 'Elevated' : 'Normal',
        statusTone:  tone,
      });
    }
    if (r.blood_sugar_fasting) {
      const tone = r.blood_sugar_fasting >= 126 ? 'bad' : r.blood_sugar_fasting >= 100 ? 'warning' : 'good';
      records.push({
        id:          `medical-sugar-${r.id}`,
        categoryId:  'medical',
        title:       'Blood Sugar (Fasting)',
        subtitle:    `${r.blood_sugar_fasting} mg/dL`,
        isoDate:     r.iso_date,
        statusLabel: r.blood_sugar_fasting >= 126 ? 'High' : r.blood_sugar_fasting >= 100 ? 'Pre-diabetic' : 'Normal',
        statusTone:  tone,
      });
    }
  }

  // Sort all records newest first
  records.sort((a, b) => (b.isoDate || '').localeCompare(a.isoDate || ''));

  return { categories: CATEGORIES, records };
};

module.exports = { getHistory };
