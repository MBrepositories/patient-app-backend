const db = require('../config/db');

const getMadhavbaugMedicinesMaster = async () => {
  const [rows] = await db.query(
    `SELECT id, name, batch_number, expiry_date, uom, dosage, price, category, status, medium, route, frequency, duration
     FROM madhavbaug_medicines WHERE status = 'active' ORDER BY name ASC`
  );
  return { total: rows.length, medicines: rows };
};

const getAllopathyMedicinesMaster = async (query) => {
  const [rows] = await db.query(
    `SELECT id, medicine_name, uom, default_dosage, default_frequency, prescription, type_of_sell,
            manufacturer, salt, mrp, status, uses, side_effects, how_to_use, chemical_class,
            habit_forming, therapeutic_class, action_class, how_it_works
     FROM medicines WHERE medicine_name LIKE ? ORDER BY medicine_name ASC LIMIT 50`,
    [`${query}%`]
  );
  return { total: rows.length, medicines: rows };
};

// ─── Parse Madhavbaug dosage string "M-A-N" ──────────────────────────────────

const parseMadhavbaugDosage = (dosage) => {
  if (!dosage) return { morning: 0, afternoon: 0, night: 0, sos: 0 };
  if (dosage.toUpperCase() === 'SOS') return { morning: 0, afternoon: 0, night: 0, sos: 1 };
  const parts = dosage.split('-');
  return {
    morning:   parseFloat(parts[0]) || 0,
    afternoon: parseFloat(parts[1]) || 0,
    night:     parseFloat(parts[2]) || 0,
    sos:       0,
  };
};

// Get latest appointment_id for patient
const getLatestAppointmentId = async (patientId) => {
  const [[row]] = await db.query(
    `SELECT id FROM appointments WHERE patient_id = ? ORDER BY id DESC LIMIT 1`,
    [patientId]
  );
  return row ? row.id : null;
};

// ─── 1. Medicines Summary ─────────────────────────────────────────────────────

const getMedicinesSummary = async (patientId) => {
  const appointmentId = await getLatestAppointmentId(patientId);
  if (!appointmentId) {
    return { plans: [], taperedMedications: [] };
  }

  const today = new Date().toISOString().slice(0, 10);

  // Fetch Madhavbaug medicines for latest appointment
  const [madhavRows] = await db.query(
    `SELECT id, medicine_id, medicine_name, dosage, uom, frequency, duration
     FROM patient_madhavbaug
     WHERE appointment_id = ? AND medicine_name IS NOT NULL AND medicine_name != ''`,
    [appointmentId]
  );

  // Fetch Allopathy medicines for latest appointment (skip notonmedicine=1)
  const [alloRows] = await db.query(
    `SELECT id, medicine_id, medicine_name, dosage, frequency, uom, morning, afternoon, night, other, duration, instructions
     FROM patient_allopathy
     WHERE appointment_id = ? AND notonmedicine = 0 AND medicine_name IS NOT NULL AND medicine_name != ''`,
    [appointmentId]
  );

  // Get today's taken doses from app_medicine_logs
  const [takenRows] = await db.query(
    `SELECT medicine_id, medicine_type, slot
     FROM app_medicine_logs
     WHERE app_user_id = ? AND DATE(logged_at) = ? AND taken = 1`,
    [patientId, today]
  );

  const takenMap = {};
  takenRows.forEach(r => {
    const key = `${r.medicine_type}-${r.medicine_id}`;
    if (!takenMap[key]) takenMap[key] = {};
    takenMap[key][r.slot] = true;
  });

  // Build Madhavbaug medications
  const madhavMedications = madhavRows.map(r => {
    const doses = parseMadhavbaugDosage(r.dosage);
    const key   = `madhavbaug-${r.id}`;
    const taken = takenMap[key] || {};
    return {
      id:         `madhav-${r.id}`,
      medicineId: r.id,
      type:       'madhavbaug',
      name:       r.medicine_name,
      formLabel:  r.uom ? r.uom.toUpperCase() : 'TABLET',
      doses,
      takenToday: {
        morning:   !!taken.morning,
        afternoon: !!taken.afternoon,
        night:     !!taken.night,
        sos:       !!taken.sos,
      },
    };
  });

  // Build Allopathy medications
  const alloMedications = alloRows.map(r => {
    const doses = {
      morning:   r.morning   ? parseFloat(r.morning)   || 1 : 0,
      afternoon: r.afternoon ? parseFloat(r.afternoon) || 1 : 0,
      night:     r.night     ? parseFloat(r.night)     || 1 : 0,
      sos:       r.other     ? 1 : 0,
    };
    const key   = `allopathy-${r.id}`;
    const taken = takenMap[key] || {};
    return {
      id:         `allo-${r.id}`,
      medicineId: r.id,
      type:       'allopathy',
      name:       r.medicine_name,
      formLabel:  r.uom ? r.uom.toUpperCase() : 'TABLET',
      doses,
      takenToday: {
        morning:   !!taken.morning,
        afternoon: !!taken.afternoon,
        night:     !!taken.night,
        sos:       !!taken.sos,
      },
    };
  });

  return {
    plans: [
      {
        id:          'madhavbaug-core',
        title:       'Madhavbaug Medicines',
        subtitle:    'ACTIVE CORE PLAN',
        tone:        'core',
        medications: madhavMedications,
      },
      {
        id:          'ongoing-allopathy',
        title:       'Ongoing Allopathy',
        subtitle:    'ACTIVE TAPERING',
        tone:        'tapering',
        medications: alloMedications,
      },
    ],
    taperedMedications: [],
  };
};

// ─── 2. Mark Dose Taken ───────────────────────────────────────────────────────

const markDoseTaken = async (patientId, medicationId, { slot, taken, type }) => {
  const today = new Date().toISOString().slice(0, 10);

  // Check if already logged today
  const [[existing]] = await db.query(
    `SELECT id FROM app_medicine_logs
     WHERE app_user_id = ? AND medicine_id = ? AND medicine_type = ? AND slot = ? AND DATE(logged_at) = ?`,
    [patientId, medicationId, type, slot, today]
  );

  if (existing) {
    await db.query(
      `UPDATE app_medicine_logs SET taken = ? WHERE id = ?`,
      [taken ? 1 : 0, existing.id]
    );
  } else {
    await db.query(
      `INSERT INTO app_medicine_logs (app_user_id, medicine_id, medicine_type, slot, taken) VALUES (?, ?, ?, ?, ?)`,
      [patientId, medicationId, type, slot, taken ? 1 : 0]
    );
  }

  // Trigger medication notification only when marked as taken
  if (taken) {
    const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
    db.query(
      `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'medication', 'Medication Taken', ?)`,
      [patientId, `You have marked your ${slotLabel} dose as taken. Keep it up!`]
    ).catch(() => {});
  }
};

// ─── 3. Medicine Adherence ────────────────────────────────────────────────────

const getMedicineAdherence = async (patientId) => {
  const appointmentId = await getLatestAppointmentId(patientId);

  const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Get last 7 days of logs
  const [logs] = await db.query(
    `SELECT medicine_id, medicine_type, slot, taken, DATE(logged_at) AS log_date
     FROM app_medicine_logs
     WHERE app_user_id = ? AND DATE(logged_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     ORDER BY logged_at ASC`,
    [patientId]
  );

  // Get all medicines for this patient
  let allMedicines = [];
  if (appointmentId) {
    const [madhavRows] = await db.query(
      `SELECT id, medicine_name, dosage, uom FROM patient_madhavbaug
       WHERE appointment_id = ? AND medicine_name IS NOT NULL AND medicine_name != ''`,
      [appointmentId]
    );
    const [alloRows] = await db.query(
      `SELECT id, medicine_name, frequency, uom FROM patient_allopathy
       WHERE appointment_id = ? AND notonmedicine = 0 AND medicine_name IS NOT NULL AND medicine_name != ''`,
      [appointmentId]
    );

    allMedicines = [
      ...madhavRows.map(r => {
        const d = parseMadhavbaugDosage(r.dosage);
        const slots = Object.entries(d).filter(([, v]) => v > 0).map(([k]) => k);
        const slotCodes = slots.map(s => s === 'morning' ? 'M' : s === 'afternoon' ? 'A' : s === 'night' ? 'N' : 'SOS');
        return {
          id:             `madhav-${r.id}`,
          medicineId:     r.id,
          type:           'madhavbaug',
          name:           r.medicine_name,
          frequencyLabel: `${slotCodes.join(', ')} daily`,
          badge:          { label: 'ACTIVE', tone: 'active' },
          scheduledSlots: slots,
        };
      }),
      ...alloRows.map(r => {
        return {
          id:             `allo-${r.id}`,
          medicineId:     r.id,
          type:           'allopathy',
          name:           r.medicine_name,
          frequencyLabel: r.frequency || 'Daily',
          badge:          { label: 'ACTIVE', tone: 'active' },
          scheduledSlots: ['morning', 'afternoon', 'night'].filter(s => r[s]),
        };
      }),
    ];
  }

  // Build log map: key = `type-medicineId-date-slot`
  const logMap = {};
  logs.forEach(l => {
    const key = `${l.medicine_type}-${l.medicine_id}-${l.log_date}-${l.slot}`;
    logMap[key] = l.taken ? 'logged' : 'missed';
  });

  // Build 7-day dates
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      date:  d.toISOString().slice(0, 10),
      label: DAY_LABELS[d.getDay()],
      isToday: i === 0,
    });
  }

  // Build per-medicine 7-day status
  const medications = allMedicines.map(med => ({
    id:             med.id,
    name:           med.name,
    frequencyLabel: med.frequencyLabel,
    badge:          med.badge,
    days: days.map(day => {
      // Check if any scheduled slot was logged
      const slotStatuses = med.scheduledSlots.map(slot => {
        const key = `${med.type}-${med.medicineId}-${day.date}-${slot}`;
        return logMap[key] || (day.isToday ? 'pending' : 'missed');
      });
      const status = slotStatuses.includes('logged') ? 'logged'
        : slotStatuses.includes('pending') ? 'pending' : 'missed';
      return { label: day.label, status };
    }),
  }));

  // Overall adherence
  const totalExpected = logs.length;
  const totalTaken = logs.filter(l => l.taken).length;
  const overallPercent = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 100;

  return {
    overallPercent,
    trackingLabel: 'M-A-N-SOS aware tracking',
    doseLegend: [
      { code: 'M', label: 'Morning' },
      { code: 'A', label: 'Afternoon' },
      { code: 'N', label: 'Night' },
    ],
    progressRangeLabel: '7-Day Progress',
    sourceLabel: 'PowerMAP',
    medications,
    compliancePolicy: 'Adherence is calculated based on doses logged within their scheduled windows.',
  };
};

module.exports = {
  getMadhavbaugMedicinesMaster,
  getAllopathyMedicinesMaster,
  getMedicinesSummary,
  markDoseTaken,
  getMedicineAdherence,
};
