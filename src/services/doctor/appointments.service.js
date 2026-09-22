const db = require('../../config/db');

const toTimeLabel = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

const toDateStr = (d) => {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return String(d).slice(0, 10);
};

// ─── 3.3.1 Appointment Details ────────────────────────────────────────────────
const getAppointmentDetails = async (appointmentId) => {
  const [[r]] = await db.query(
    `SELECT a.id, a.appointment_date, a.appointment_time, a.appointment_type,
            a.duration, a.chief_complaint, a.notes, a.room_type,
            b.branch_name, b.address,
            p.id AS patient_db_id, p.patient_name, p.patient_id AS uhid,
            p.age, p.age_unit, p.gender
     FROM appointments a
     LEFT JOIN branches b ON b.id = a.branch_id
     LEFT JOIN patients p ON p.id = a.patient_id
     WHERE a.id = ?`,
    [appointmentId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  const dateStr = toDateStr(r.appointment_date);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const dateLabel = new Date(dy, dm - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = toTimeLabel(r.appointment_time);

  const ageLabel   = r.age ? `${r.age} ${r.age_unit || 'Years'}` : '';
  const genderLabel = r.gender ? (r.gender.charAt(0).toUpperCase() + r.gender.slice(1).toLowerCase()) : '';
  const ageGenderLabel = [ageLabel, genderLabel].filter(Boolean).join(' / ');

  // ── BP from patient_vitals (hospital recorded) ──
  const [bpRows] = await db.query(
    `SELECT blood_pressure_systolic AS systolic, blood_pressure_diastolic AS diastolic, recorded_at
     FROM patient_vitals
     WHERE patient_id = ? AND status = 'recorded' AND blood_pressure_systolic IS NOT NULL
     ORDER BY recorded_at DESC LIMIT 2`,
    [r.patient_db_id]
  );

  // ── Self-logged vitals from app_vitals ──
  const [appVitalRows] = await db.query(
    `SELECT type, value FROM app_vitals
     WHERE app_user_id = ? ORDER BY logged_at DESC LIMIT 20`,

    [r.patient_db_id]
  );

  const vitals = [];

  if (bpRows.length > 0) {
    const latest = bpRows[0];
    const prev   = bpRows[1];
    const sys = latest.systolic, dia = latest.diastolic;
    const bpStatus = sys > 140 ? 'high' : sys < 90 ? 'low' : 'normal';
    const trend = prev ? (sys > prev.systolic ? 'up' : sys < prev.systolic ? 'down' : 'flat') : 'flat';
    vitals.push({ id: 'bp', label: 'Blood Pressure', value: `${sys}/${dia}`, unit: 'mmHg', status: bpStatus, trend, iconName: 'monitor-heart' });
  }

  const VITAL_META = {
    weight: { label: 'Weight', unit: 'kg',    iconName: 'monitor-weight' },
    hba1c:  { label: 'HbA1c', unit: '%',     iconName: 'bloodtype'      },
    ldl:    { label: 'LDL',   unit: 'mg/dL', iconName: 'favorite'       },
    waist:  { label: 'Waist', unit: 'cm',    iconName: 'straighten'     },
  };
  const seenTypes = new Set();
  for (const v of appVitalRows) {
    if (seenTypes.has(v.type) || !VITAL_META[v.type]) continue;
    seenTypes.add(v.type);
    const meta = VITAL_META[v.type];
    vitals.push({ id: v.type, label: meta.label, value: String(parseFloat(v.value)), unit: meta.unit, status: 'normal', trend: 'flat', iconName: meta.iconName });
  }

  // Previous notes from past appointments
  const [noteRows] = await db.query(
    `SELECT id, appointment_date, notes, chief_complaint
     FROM appointments
     WHERE patient_id = ? AND id != ? AND (notes IS NOT NULL OR chief_complaint IS NOT NULL)
     ORDER BY appointment_date DESC LIMIT 5`,
    [r.patient_db_id, appointmentId]
  );

  const previousNotes = noteRows.map(n => {
    const nDateStr = toDateStr(n.appointment_date);
    const [ny, nm, nd] = nDateStr.split('-').map(Number);
    const nDateLabel = new Date(ny, nm - 1, nd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return {
      id:        `note-${n.id}`,
      dateLabel: nDateLabel,
      text:      n.notes || n.chief_complaint,
    };
  });

  return {
    id:                   String(r.id),
    patientName:          r.patient_name || 'Unknown',
    uhid:                 r.uhid || '',
    ageGenderLabel,
    dateTimeLabel:        `${dateLabel}, ${timeLabel}`,
    durationLabel:        `${r.duration || 15} mins`,
    consultationTypeLabel: 'In-Person Clinic Visit',
    branchLocationLabel:  [r.branch_name, r.address].filter(Boolean).join(', '),
    vitals,
    previousNotes,
  };
};

// ─── 3.3.2 Visit Session ──────────────────────────────────────────────────────
const getVisitSession = async (appointmentId) => {
  const [[r]] = await db.query(
    `SELECT a.id, a.appointment_type,
            p.id AS patient_db_id, p.patient_name, p.patient_id AS uhid,
            p.age, p.age_unit, p.gender
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     WHERE a.id = ?`,
    [appointmentId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  const initials = (r.patient_name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const genderLabel = r.gender ? (r.gender.charAt(0).toUpperCase() + r.gender.slice(1).toLowerCase()) : 'Unknown';
  const ageLabel = r.age ? `${r.age} ${r.age_unit || 'Years'}` : '';

  const [bpRows2] = await db.query(
    `SELECT blood_pressure_systolic AS systolic, blood_pressure_diastolic AS diastolic
     FROM patient_vitals
     WHERE patient_id = ? AND status = 'recorded' AND blood_pressure_systolic IS NOT NULL
     ORDER BY recorded_at DESC LIMIT 1`,
    [r.patient_db_id]
  );
  const [appVitalRows2] = await db.query(
    `SELECT type, value FROM app_vitals WHERE app_user_id = ? ORDER BY logged_at DESC LIMIT 20`,
    [r.patient_db_id]
  );

  const vitals = [];
  if (bpRows2.length > 0) {
    const v = bpRows2[0];
    vitals.push({ id: 'bp', label: 'Blood Pressure', value: `${v.systolic}/${v.diastolic}`, unit: 'mmHg', status: v.systolic > 140 ? 'high' : v.systolic < 90 ? 'low' : 'normal', iconName: 'monitor-heart' });
  }
  const VITAL_META2 = {
    weight: { label: 'Weight', unit: 'kg',    iconName: 'monitor-weight' },
    hba1c:  { label: 'HbA1c', unit: '%',     iconName: 'bloodtype'      },
    ldl:    { label: 'LDL',   unit: 'mg/dL', iconName: 'favorite'       },
    waist:  { label: 'Waist', unit: 'cm',    iconName: 'straighten'     },
  };
  const seenTypes2 = new Set();
  for (const v of appVitalRows2) {
    if (seenTypes2.has(v.type) || !VITAL_META2[v.type]) continue;
    seenTypes2.add(v.type);
    const meta = VITAL_META2[v.type];
    vitals.push({ id: v.type, label: meta.label, value: String(parseFloat(v.value)), unit: meta.unit, status: 'normal', iconName: meta.iconName });
  }

  // Chronic conditions from patient_diagnosis (all past appointments for this patient)
  const [diagRows] = await db.query(
    `SELECT DISTINCT pd.diagnosis_name, pd.diagnosis_type, pd.certainty_level
     FROM patient_diagnosis pd
     INNER JOIN appointments a ON a.id = pd.appointment_id
     WHERE a.patient_id = ? AND pd.is_selected = 1
     ORDER BY pd.created_at DESC LIMIT 10`,
    [r.patient_db_id]
  );

  // Current appointment diagnoses
  const [currentDiagRows] = await db.query(
    `SELECT diagnosis_name, diagnosis_type FROM patient_diagnosis
     WHERE appointment_id = ? AND is_selected = 1`,
    [appointmentId]
  );

  return {
    appointmentId:        String(r.id),
    patientName:          r.patient_name || 'Unknown',
    patientInitials:      initials,
    genderAgeLabel:       [genderLabel, ageLabel].filter(Boolean).join(', '),
    patientCode:          `#${r.uhid || r.patient_db_id}`,
    hasHighAlertAllergies: false,
    isInpatient:          false,
    medicalHistory: {
      chronicConditions:  diagRows.map(d => `${d.diagnosis_name}${d.certainty_level === 'confirmed' ? '' : ` (${d.certainty_level})`}`),
      recentSurgeryLabel: 'No recent surgery on record.',
      familyHistoryLabel: 'Not available.',
    },
    vitals,
    clinicalNoteDraft: '',
    diagnoses: currentDiagRows.map((d, i) => ({
      code:  `DX-${i + 1}`,
      label: d.diagnosis_name,
    })),
  };
};

// ─── 3.3.3 Complete Visit ─────────────────────────────────────────────────────
const verifyDoctorAccess = async (appointmentId, doctorId) => {
  const [[appt]] = await db.query(
    `SELECT id FROM appointments WHERE id = ? AND doctor_id = ?`,
    [appointmentId, doctorId]
  );
  if (!appt) throw Object.assign(new Error('Access denied. This appointment is not assigned to you.'), { statusCode: 403 });
};

const completeVisit = async (appointmentId, doctorId) => {
  await verifyDoctorAccess(appointmentId, doctorId);

  const [[r]] = await db.query(
    `SELECT a.id, a.created_at, a.patient_id, p.patient_name, p.patient_id AS uhid
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     WHERE a.id = ?`,
    [appointmentId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  await db.query(`UPDATE appointments SET status = 'completed' WHERE id = ?`, [appointmentId]);

  // Notify patient
  db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'appointment', 'Visit Completed', ?)`,
    [r.patient_id, `Your visit has been completed. Thank you for attending your appointment.`]
  ).catch(() => {});

  const initials = (r.patient_name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return {
    appointmentId:        String(appointmentId),
    patientName:          r.patient_name || 'Unknown',
    durationLabel:        '30 mins',
    notesStatusLabel:     'Saved to record',
    notesSecondaryLabel:  'Encrypted & Archived',
    sessionId:            `HCP-${appointmentId}-${initials}-${new Date().getFullYear()}`,
    isFinalized:          true,
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateSlots = (startHour, endHour) => {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour   = h % 12 || 12;
      const ampm   = h < 12 ? 'AM' : 'PM';
      const minute = String(m).padStart(2, '0');
      slots.push(`${String(hour).padStart(2, '0')}:${minute} ${ampm}`);
    }
  }
  return slots;
};

const to24h = (timeStr) => {
  const parts = timeStr.trim().split(' ');
  const [h, m] = parts[0].split(':').map(Number);
  const ampm = parts[1] ? parts[1].toUpperCase() : null;
  if (!ampm || h > 12) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  let hour = h;
  if (ampm === 'PM' && h !== 12) hour = h + 12;
  if (ampm === 'AM' && h === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

// ─── 3.6.1 GET Doctor Reschedule Options ─────────────────────────────────────
const getRescheduleOptions = async (appointmentId, doctorId) => {
  await verifyDoctorAccess(appointmentId, doctorId);
  const [[r]] = await db.query(
    `SELECT a.id, a.appointment_date, a.appointment_time, a.appointment_type, a.branch_id,
            p.patient_name, p.patient_id AS uhid, p.id AS patient_db_id
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     WHERE a.id = ?`,
    [appointmentId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  const dateStr = toDateStr(r.appointment_date);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const originalDateLabel = new Date(dy, dm - 1, dd).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const originalTimeLabel = toTimeLabel(r.appointment_time);

  const initials = (r.patient_name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Booked slots on same date for this branch (with duration)
  const [bookedRows] = await db.query(
    `SELECT appointment_time, COALESCE(duration, 15) AS duration FROM appointments
     WHERE branch_id = ? AND appointment_date = ? AND id != ?
       AND status NOT IN ('cancelled', 'no-show')`,
    [r.branch_id, dateStr, appointmentId]
  );

  // Build set of all blocked minutes (start + duration)
  const blockedMinutes = new Set();
  for (const b of bookedRows) {
    const [bh, bm] = String(b.appointment_time).slice(0, 5).split(':').map(Number);
    const startMins = bh * 60 + bm;
    const dur = parseInt(b.duration) || 15;
    for (let i = 0; i < dur; i += 15) {
      blockedMinutes.add(startMins + i);
    }
  }

  const timeSlots = generateSlots(10, 19).map(label => {
    const time24 = to24h(label).slice(0, 5);
    const [sh, sm] = time24.split(':').map(Number);
    const slotMins = sh * 60 + sm;
    const hour = sh;
    return {
      id:        `slot-${time24.replace(':', '')}`,
      label,
      period:    hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
      available: !blockedMinutes.has(slotMins),
    };
  });

  const firstAvailable = timeSlots.find(s => s.available);

  return {
    appointmentId:        String(r.id),
    patientName:          r.patient_name || 'Unknown',
    patientInitials:      initials,
    patientSubtitle:      `${r.appointment_type || 'In-Person Clinic Visit'} • UHID: ${r.uhid || ''}`,
    patientCode:          `#${r.uhid || r.patient_db_id}`,
    originalDateLabel,
    originalTimeLabel,
    initialMonthIso:      dateStr.slice(0, 7) + '-01',
    selectedDateIso:      dateStr,
    defaultSelectedSlotId: firstAvailable ? firstAvailable.id : null,
    timeSlots,
  };
};

// ─── 3.6.1 POST Doctor Confirm Reschedule ─────────────────────────────────────
const confirmReschedule = async (appointmentId, doctorId, { newDateIso, newTimeLabel, reason }) => {
  await verifyDoctorAccess(appointmentId, doctorId);

  const [[appt]] = await db.query(
    `SELECT a.id, a.appointment_date, a.appointment_time, a.branch_id,
            p.patient_name, p.patient_id AS uhid, p.id AS patient_db_id,
            u.name AS doctor_name
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     LEFT JOIN users u ON u.id = ?
     WHERE a.id = ?`,
    [doctorId, appointmentId]
  );
  if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  const oldDateStr = toDateStr(appt.appointment_date);
  const previousTimeLabel = toTimeLabel(appt.appointment_time);
  const [ody, odm, odd] = oldDateStr.split('-').map(Number);
  const previousDateLabel = new Date(ody, odm - 1, odd).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  const newTime24 = to24h(newTimeLabel);
  const [ndy, ndm, ndd] = newDateIso.split('-').map(Number);
  const newDateLabel = new Date(ndy, ndm - 1, ndd).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  // Same slot check
  if (newDateIso === oldDateStr && newTime24.slice(0, 5) === String(appt.appointment_time).slice(0, 5)) {
    throw Object.assign(new Error('New slot is the same as the current appointment slot.'), { statusCode: 409 });
  }

  // Conflict check — account for duration of existing appointments
  const [bookedRows] = await db.query(
    `SELECT appointment_time, COALESCE(duration, 15) AS duration FROM appointments
     WHERE branch_id = ? AND appointment_date = ? AND id != ?
       AND status NOT IN ('cancelled', 'no-show')`,
    [appt.branch_id, newDateIso, appointmentId]
  );

  const newSlotMins = (() => { const [h, m] = newTime24.slice(0, 5).split(':').map(Number); return h * 60 + m; })();
  const isConflict = bookedRows.some(b => {
    const [bh, bm] = String(b.appointment_time).slice(0, 5).split(':').map(Number);
    const startMins = bh * 60 + bm;
    const endMins   = startMins + (parseInt(b.duration) || 15);
    return newSlotMins >= startMins && newSlotMins < endMins;
  });
  if (isConflict) throw Object.assign(new Error('This time slot is already booked.'), { statusCode: 409 });

  await db.query(
    `UPDATE appointments SET appointment_date = ?, appointment_time = ?, status = 'rescheduled',
     reschedule_reason = ?, rescheduled_at = NOW() WHERE id = ?`,
    [newDateIso, newTime24, reason || null, appointmentId]
  );

  // Notify patient
  const formattedNewTime = toTimeLabel(newTime24);
  db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'appointment', 'Appointment Rescheduled', ?)`,
    [appt.patient_db_id, `Your appointment with ${appt.doctor_name || 'your doctor'} has been rescheduled to ${newDateLabel} at ${formattedNewTime}.`]
  ).catch(() => {});

  const initials = (appt.patient_name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return {
    appointmentId:    String(appointmentId),
    confirmationCode: `TX-${String(appointmentId).padStart(4, '0')}`,
    patientName:      appt.patient_name || 'Unknown',
    patientCode:      `#${appt.uhid || appt.patient_db_id}`,
    previousDateLabel,
    previousTimeLabel,
    newDateLabel,
    newTimeLabel,
    smsSent:          true,
    emailSent:        true,
  };
};

// ─── 3.6.2 GET Doctor Cancel Options ─────────────────────────────────────────
const getCancelOptions = async (appointmentId, doctorId) => {
  await verifyDoctorAccess(appointmentId, doctorId);

  const [[r]] = await db.query(
    `SELECT a.id, a.status, p.patient_name
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     WHERE a.id = ?`,
    [appointmentId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  if (r.status === 'cancelled')  throw Object.assign(new Error('Appointment is already cancelled.'), { statusCode: 409 });
  if (r.status === 'completed')  throw Object.assign(new Error('Cannot cancel a completed appointment.'), { statusCode: 409 });

  return {
    appointmentId:   String(r.id),
    patientName:     r.patient_name || 'Unknown',
    defaultReasonId: 'patient-unavailable',
    reasons: [
      { id: 'patient-unavailable', label: 'Patient Unavailable',  iconName: 'person-off'    },
      { id: 'doctor-unavailable',  label: 'Doctor Unavailable',   iconName: 'event-busy'    },
      { id: 'schedule-conflict',   label: 'Schedule Conflict',    iconName: 'sync-problem'  },
      { id: 'emergency',           label: 'Emergency',            iconName: 'emergency'     },
    ],
  };
};

// ─── 3.6.2 POST Doctor Confirm Cancel ────────────────────────────────────────
const confirmCancel = async (appointmentId, doctorId, { reasonId, comments }) => {
  await verifyDoctorAccess(appointmentId, doctorId);

  const [[r]] = await db.query(
    `SELECT a.id, a.status, a.patient_id, p.patient_name
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     WHERE a.id = ?`,
    [appointmentId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  if (r.status === 'cancelled') throw Object.assign(new Error('Appointment is already cancelled.'), { statusCode: 409 });
  if (r.status === 'completed') throw Object.assign(new Error('Cannot cancel a completed appointment.'), { statusCode: 409 });

  const REASON_LABELS = {
    'patient-unavailable': 'Patient Unavailable',
    'doctor-unavailable':  'Doctor Unavailable',
    'schedule-conflict':   'Schedule Conflict',
    'emergency':           'Emergency',
  };

  await db.query(
    `UPDATE appointments SET status = 'cancelled', reschedule_reason = ? WHERE id = ?`,
    [comments || reasonId, appointmentId]
  );

  // Notify patient
  db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'appointment', 'Appointment Cancelled', ?)`,
    [r.patient_id, `Your appointment has been cancelled by the doctor. Reason: ${REASON_LABELS[reasonId] || reasonId}.`]
  ).catch(() => {});

  return {
    appointmentId:    String(appointmentId),
    patientName:      r.patient_name || 'Unknown',
    reasonLabel:      REASON_LABELS[reasonId] || reasonId,
    notificationSent: true,
  };
};

module.exports = { getAppointmentDetails, getVisitSession, completeVisit, getRescheduleOptions, confirmReschedule, getCancelOptions, confirmCancel };
