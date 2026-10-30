const db = require('../config/db');

// ─── Helper: generate appointment ID like AP260001 ────────────────────────────
const generateAppointmentId = async () => {
  const prefix = 'AP';
  const year   = new Date().getFullYear().toString().slice(-2);
  const [[last]] = await db.query(
    `SELECT appointment_id FROM appointments WHERE appointment_id LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}${year}%`]
  );
  const lastNum = last ? parseInt(last.appointment_id.slice(4)) : 0;
  const newNum  = lastNum + 1;
  return `${prefix}${year}${String(newNum).padStart(4, '0')}`;
};

// ─── Helper: generate 15-min time slots for a day ────────────────────────────
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

  // Already 24h format (no AM/PM or hour > 12)
  if (!ampm || h > 12) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }

  let hour = h;
  if (ampm === 'PM' && h !== 12) hour = h + 12;
  if (ampm === 'AM' && h === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
};

// ─── 1. Booking Options ───────────────────────────────────────────────────────
const getBookingOptions = async (patientId) => {
  const [[patient]] = await db.query(
    `SELECT branch_id FROM patients WHERE id = ? LIMIT 1`,
    [patientId]
  );
  if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });

  const [doctors] = await db.query(
    `SELECT u.id, u.name, u.specialization
     FROM users u
     WHERE u.branch_id = ? AND u.role = 'doctor' AND u.is_active = 1
     ORDER BY u.name ASC`,
    [patient.branch_id]
  );

  const doctorList = doctors.map(d => ({
    id:                 `dr-${d.id}`,
    dbId:               d.id,
    name:               d.name,
    specialty:          d.specialization || 'General Physician',
    iconName:           null,
    rating:             null,
    experienceLabel:    'Experienced',
    nextAvailableLabel: 'Today',
  }));

  const [[apptCheck]] = await db.query(
    `SELECT id FROM appointments WHERE patient_id = ? LIMIT 1`,
    [patientId]
  );
  const patientStatus = apptCheck ? 'existing' : 'new';

  return {
    doctors:         doctorList,
    totalFoundCount: doctorList.length,
    patientStatus,
    newPatientPolicy: {
      requiresRegistration: patientStatus === 'new',
      requiresPayment:      false,
      registrationFeeLabel: '₹0',
    },
  };
};

// ─── 2. Doctor Profile ────────────────────────────────────────────────────────
const getDoctorProfile = async (doctorId, dateIso) => {
  const [[doctor]] = await db.query(
    `SELECT u.id, u.name, u.specialization, u.branch_id,
            b.branch_name, b.address
     FROM users u
     LEFT JOIN branches b ON b.id = u.branch_id
     WHERE u.id = ? AND u.role = 'doctor' AND u.is_active = 1`,
    [doctorId]
  );
  if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });

  // Build next 7 days date list
  const today = new Date();
  const dates = [];
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    dates.push({
      isoDate:     iso,
      weekday:     DAYS[d.getDay()],
      weekdayFull: DAYS_FULL[d.getDay()],
      day:         String(d.getDate()),
    });
  }

  // Selected date — default today
  const selectedDate = dateIso || today.toISOString().slice(0, 10);

  // Get already booked slots on selected date for this branch
  const [bookedRows] = await db.query(
    `SELECT appointment_time FROM appointments
     WHERE branch_id = ? AND appointment_date = ?
       AND status NOT IN ('cancelled', 'no-show')`,
    [doctor.branch_id, selectedDate]
  );
  const bookedTimes = new Set(bookedRows.map(r => {
    const t = r.appointment_time;
    return typeof t === 'string' ? t.slice(0, 5) : '';
  }));

  // Generate slots: morning 9-12, afternoon 12-17, evening 17-20
  const periods = [
    { period: 'morning',   label: 'Morning',   startH: 9,  endH: 12 },
    { period: 'afternoon', label: 'Afternoon',  startH: 12, endH: 17 },
    { period: 'evening',   label: 'Evening',    startH: 17, endH: 20 },
  ];

  const schedule = periods.map(p => ({
    period: p.period,
    label:  p.label,
    slots:  generateSlots(p.startH, p.endH).map(timeLabel => {
      const time24 = to24h(timeLabel).slice(0, 5);
      return {
        time:      timeLabel,
        available: !bookedTimes.has(time24),
      };
    }),
  }));

  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return {
    id:               `dr-${doctor.id}`,
    dbId:             doctor.id,
    name:             doctor.name,
    specialty:        doctor.specialization || 'General Physician',
    iconName:         null,
    badgeLabel:       null,
    clinicLocation:   doctor.branch_name || '',
    clinicAddressLine: doctor.address    || '',
    stats: [
      { id: 'experience', value: 'Experienced', label: 'EXPERIENCE' },
    ],
    monthLabel,
    dates,
    selectedDateIso: selectedDate,
    schedule,
    healthTip: 'Please carry your latest reports and previous prescriptions.',
    fees: {
      consultationFee:    0,
      serviceTaxPercent:  0,
      serviceTaxAmount:   0,
      administrativeFee:  0,
      totalAmount:        0,
    },
  };
};

// ─── 3. Book Appointment ──────────────────────────────────────────────────────
const bookAppointment = async (patientId, { doctorId, isoDate, dateLabel, timeSlot, branchId }) => {
  // Get patient's branch if not provided
  const [[patient]] = await db.query(
    `SELECT branch_id, patient_id FROM patients WHERE id = ? LIMIT 1`,
    [patientId]
  );
  if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });

  const resolvedBranchId = branchId || patient.branch_id;

  // Get doctor info
  const [[doctor]] = await db.query(
    `SELECT id, name, specialization FROM users WHERE id = ? AND role = 'doctor'`,
    [doctorId]
  );
  if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });

  // Get branch info
  const [[branch]] = await db.query(
    `SELECT branch_name, address, consult_rooms FROM branches WHERE id = ?`,
    [resolvedBranchId]
  );

  // Convert timeSlot "09:30 AM" → "09:30:00"
  const time24 = to24h(timeSlot);

  // Check slot not already taken
  const [[existing]] = await db.query(
    `SELECT id FROM appointments
     WHERE branch_id = ? AND appointment_date = ? AND appointment_time = ?
       AND status NOT IN ('cancelled', 'no-show')`,
    [resolvedBranchId, isoDate, time24]
  );
  if (existing) throw Object.assign(new Error('This slot is already booked. Please choose another time.'), { statusCode: 409 });

  // Generate appointment ID
  const appointmentId = await generateAppointmentId();

  // Use first consult room of the branch
  const roomType = `consult_room_1`;

  // Insert appointment
  await db.query(
    `INSERT INTO appointments
       (appointment_id, patient_id, branch_id, doctor_id, appointment_date, appointment_time,
        appointment_type, room_type, duration, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'Follow UP Consultation', ?, 15, 'scheduled', ?, NOW())`,
    [appointmentId, patientId, resolvedBranchId, doctorId, isoDate, time24, roomType, patientId]
  );

  // Trigger appointment notification
  db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'appointment', 'Appointment Booked', ?)`,
    [patientId, `Your appointment with ${doctor.name} is scheduled for ${dateLabel || isoDate} at ${timeSlot}.`]
  ).catch(() => {});

  return {
    confirmationId:   appointmentId,
    doctorName:       doctor.name,
    doctorSpecialty:  doctor.specialization || 'General Physician',
    doctorImage:      null,
    date:             dateLabel || isoDate,
    timeSlot,
    serviceType:      'Follow UP Consultation',
    clinicName:       branch ? branch.branch_name : '',
    clinicAddress:    branch ? branch.address : '',
  };
};

// ─── 4. Appointments List ─────────────────────────────────────────────────────
const getAppointmentsList = async (patientId) => {
  const [rows] = await db.query(
    `SELECT a.id, a.appointment_id, a.appointment_date, a.appointment_time,
            a.appointment_type, a.status, a.room_type,
            b.branch_name, b.address,
            u.name AS doctor_name, u.specialization
     FROM appointments a
     LEFT JOIN branches b ON b.id = a.branch_id
     LEFT JOIN users u ON u.id = a.doctor_id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [patientId]
  );

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = [];
  const history  = [];

  rows.forEach(r => {
    const dateStr = r.appointment_date instanceof Date
      ? `${r.appointment_date.getFullYear()}-${String(r.appointment_date.getMonth()+1).padStart(2,'0')}-${String(r.appointment_date.getDate()).padStart(2,'0')}`
      : String(r.appointment_date).slice(0, 10);

    const timeStr = r.appointment_time
      ? String(r.appointment_time).slice(0, 5)
      : '';

    // Format time to 12h
    let timeLabel = '';
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      timeLabel = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    const [dy, dm, dd] = dateStr.split('-').map(Number);
    const dateLabel = new Date(dy, dm - 1, dd).toLocaleDateString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric'
    });

    const appt = {
      id:              String(r.id),
      appointmentId:   r.appointment_id,
      doctorName:      r.doctor_name || 'Doctor',
      doctorSpecialty: r.specialization || 'General Physician',
      doctorImage:     null,
      status:          r.status || 'scheduled',
      clinicName:      r.branch_name || '',
      clinicWing:      r.room_type   || '',
      date:            dateLabel,
      time:            timeLabel,
    };

    const isUpcoming = dateStr >= today &&
      !['completed', 'cancelled', 'no-show'].includes((r.status || '').toLowerCase());

    if (isUpcoming) {
      upcoming.push(appt);
    } else {
      history.push(appt);
    }
  });

  return { upcoming, history };
};

// ─── 5. Appointment Summary ───────────────────────────────────────────────────
const getAppointmentSummary = async (patientId, appointmentId) => {
  const [[r]] = await db.query(
    `SELECT a.id, a.appointment_id, a.appointment_date, a.appointment_time,
            a.appointment_type, a.status, a.room_type, a.duration,
            a.chief_complaint, a.notes, a.total_bill, a.paid_amount,
            b.branch_name, b.address,
            u.name AS doctor_name, u.specialization,
            COALESCE(NULLIF(u.profile_picture, ''), NULLIF(u.profile_image, '')) AS doctor_image
     FROM appointments a
     LEFT JOIN branches b ON b.id = a.branch_id
     LEFT JOIN users u ON u.id = a.doctor_id
     WHERE a.id = ? AND a.patient_id = ?`,
    [appointmentId, patientId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  const dateStr = r.appointment_date instanceof Date
    ? `${r.appointment_date.getFullYear()}-${String(r.appointment_date.getMonth()+1).padStart(2,'0')}-${String(r.appointment_date.getDate()).padStart(2,'0')}`
    : String(r.appointment_date).slice(0, 10);

  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const dateLabel = new Date(dy, dm - 1, dd).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric'
  });

  const timeStr = r.appointment_time ? String(r.appointment_time).slice(0, 5) : '';
  let timeLabel = '';
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    timeLabel = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  const totalAmount  = parseFloat(r.total_bill  || 0);
  const paidAmount   = parseFloat(r.paid_amount || 0);
  const paymentStatus = paidAmount >= totalAmount && totalAmount > 0 ? 'Paid' : 'Pending';

  return {
    id:                    String(r.id),
    bookingId:             r.appointment_id,
    status:                r.status || 'scheduled',
    doctorName:            r.doctor_name    || 'Doctor',
    doctorSpecialty:       r.specialization || 'General Physician',
    doctorImage:           r.doctor_image ? `https://powermap.in/assets/profile_pictures/${r.doctor_image}` : null,
    clinicName:            r.branch_name    || '',
    clinicAddress:         r.address        || '',
    date:                  dateLabel,
    time:                  timeLabel,
    durationLabel:         `${r.duration || 15} mins`,
    consultationTypeLabel: 'In-Person Clinic Visit',
    visitReasonLabel:      r.appointment_type || 'Consultation',
    consultationFee:       totalAmount,
    serviceTaxAmount:      0,
    totalAmount,
    paymentStatusLabel:    paymentStatus,
    preVisitInstructions: [
      'Please carry your latest blood reports and prescriptions.',
      'Arrive 10 minutes before your scheduled time.',
    ],
  };
};

// ─── 6. Get Reschedule Options ────────────────────────────────────────────────
const getRescheduleOptions = async (patientId, appointmentId) => {
  const [[r]] = await db.query(
    `SELECT a.id, a.appointment_date, a.appointment_time, a.branch_id,
            u.name AS doctor_name, u.specialization, b.branch_name
     FROM appointments a
     LEFT JOIN users u ON u.id = a.doctor_id
     LEFT JOIN branches b ON b.id = a.branch_id
     WHERE a.id = ? AND a.patient_id = ?`,
    [appointmentId, patientId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  const dateStr = r.appointment_date instanceof Date
    ? `${r.appointment_date.getFullYear()}-${String(r.appointment_date.getMonth()+1).padStart(2,'0')}-${String(r.appointment_date.getDate()).padStart(2,'0')}`
    : String(r.appointment_date).slice(0, 10);

  const timeStr = r.appointment_time ? String(r.appointment_time).slice(0, 5) : '';
  let originalTimeLabel = '';
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    originalTimeLabel = `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const originalDateLabel = new Date(dy, dm - 1, dd).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric'
  });

  // Get booked slots on the same date for this branch
  const [bookedRows] = await db.query(
    `SELECT appointment_time FROM appointments
     WHERE branch_id = ? AND appointment_date = ? AND id != ?
       AND status NOT IN ('cancelled', 'no-show')`,
    [r.branch_id, dateStr, appointmentId]
  );
  const bookedTimes = new Set(bookedRows.map(b => String(b.appointment_time).slice(0, 5)));

  const timeSlots = generateSlots(9, 20).map(label => {
    const time24 = to24h(label).slice(0, 5);
    return { id: `slot-${time24.replace(':', '')}`, label, period: parseInt(time24) < 12 ? 'morning' : parseInt(time24) < 17 ? 'afternoon' : 'evening', available: !bookedTimes.has(time24) };
  });

  return {
    appointmentId:     String(r.id),
    doctorName:        r.doctor_name    || 'Doctor',
    doctorSpecialty:   r.specialization || 'General Physician',
    clinicName:        r.branch_name    || '',
    originalDateLabel,
    originalTimeLabel,
    initialMonthIso:   dateStr.slice(0, 7) + '-01',
    selectedDateIso:   dateStr,
    timeSlots,
  };
};

// ─── 7. Confirm Reschedule ────────────────────────────────────────────────────
const confirmReschedule = async (patientId, appointmentId, { newDateIso, newTimeLabel, reason }) => {
  const [[appt]] = await db.query(
    `SELECT id, appointment_date, appointment_time FROM appointments WHERE id = ? AND patient_id = ?`,
    [appointmentId, patientId]
  );
  if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });

  const oldDateStr = appt.appointment_date instanceof Date
    ? `${appt.appointment_date.getFullYear()}-${String(appt.appointment_date.getMonth()+1).padStart(2,'0')}-${String(appt.appointment_date.getDate()).padStart(2,'0')}`
    : String(appt.appointment_date).slice(0, 10);

  const oldTimeStr = String(appt.appointment_time).slice(0, 5);
  const [oh, om] = oldTimeStr.split(':').map(Number);
  const oampm = oh >= 12 ? 'PM' : 'AM';
  const ohour = oh % 12 || 12;
  const previousDateLabel = new Date(...oldDateStr.split('-').map((v,i) => i===1?Number(v)-1:Number(v))).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const previousTimeLabel = `${String(ohour).padStart(2,'0')}:${String(om).padStart(2,'0')} ${oampm}`;

  const newTime24 = to24h(newTimeLabel);
  const [ndy, ndm, ndd] = newDateIso.split('-').map(Number);
  const newDateLabel = new Date(ndy, ndm - 1, ndd).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  // Block reschedule to the exact same date + time
  if (newDateIso === oldDateStr && newTime24.slice(0, 5) === oldTimeStr) {
    throw Object.assign(new Error('New date and time is the same as the current appointment. Please choose a different slot.'), { statusCode: 409 });
  }

  // Check if new slot is already booked by another appointment
  const [[apptFull]] = await db.query(
    `SELECT branch_id, doctor_id FROM appointments WHERE id = ?`, [appointmentId]
  );
  const [[conflict]] = await db.query(
    `SELECT id FROM appointments
     WHERE branch_id = ? AND appointment_date = ? AND appointment_time = ?
       AND id != ?
       AND (status IS NULL OR status NOT IN ('cancelled', 'no-show'))
     LIMIT 1`,
    [apptFull.branch_id, newDateIso, newTime24, appointmentId]
  );
  if (conflict) throw Object.assign(new Error('This time slot is already booked. Please choose a different time.'), { statusCode: 409 });

  await db.query(
    `UPDATE appointments SET appointment_date = ?, appointment_time = ?, reschedule_reason = ?, rescheduled_at = NOW(), status = 'rescheduled' WHERE id = ?`,
    [newDateIso, newTime24, reason || null, appointmentId]
  );

  // Trigger rescheduled notification
  const [nh, nm] = newTime24.slice(0, 5).split(':').map(Number);
  const nampm = nh >= 12 ? 'PM' : 'AM';
  const nhour = nh % 12 || 12;
  const formattedNewTime = `${String(nhour).padStart(2, '0')}:${String(nm).padStart(2, '0')} ${nampm}`;
  db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'appointment', 'Appointment Rescheduled', ?)`,
    [patientId, `Your appointment has been rescheduled to ${newDateLabel} at ${formattedNewTime}.`]
  ).catch(() => {});

  return {
    appointmentId:     String(appointmentId),
    confirmationCode:  `RX-${appointmentId}`,
    doctorName:        '',
    previousDateLabel,
    previousTimeLabel,
    newDateLabel,
    newTimeLabel,
    smsSent:           false,
    emailSent:         false,
  };
};

// ─── 8. Get Cancel Reasons ────────────────────────────────────────────────────
const getCancelOptions = async (patientId, appointmentId) => {
  const [[r]] = await db.query(
    `SELECT a.id, a.status, u.name AS doctor_name, u.specialization
     FROM appointments a
     LEFT JOIN users u ON u.id = a.doctor_id
     WHERE a.id = ? AND a.patient_id = ?`,
    [appointmentId, patientId]
  );
  if (!r) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  if (r.status === 'cancelled') throw Object.assign(new Error('Appointment is already cancelled.'), { statusCode: 409 });
  if (r.status === 'completed') throw Object.assign(new Error('Completed appointments cannot be cancelled.'), { statusCode: 409 });

  return {
    appointmentId:   String(r.id),
    doctorName:      r.doctor_name    || 'Doctor',
    doctorSpecialty: r.specialization || 'General Physician',
    reasons: [
      { id: 'schedule-conflict',  label: 'Schedule Conflict',      iconName: 'event-busy' },
      { id: 'feeling-better',     label: 'Feeling Better',          iconName: 'sentiment-satisfied' },
      { id: 'personal-emergency', label: 'Personal Emergency',      iconName: 'emergency' },
      { id: 'cost-concerns',      label: 'Cost Concerns',           iconName: 'attach-money' },
      { id: 'other',              label: 'Other',                   iconName: 'more-horiz' },
    ],
    defaultReasonId: 'schedule-conflict',
  };
};

// ─── 9. Confirm Cancel ────────────────────────────────────────────────────────
const confirmCancel = async (patientId, appointmentId, { reasonId, comments }) => {
  const [[appt]] = await db.query(
    `SELECT a.id, a.status, u.name AS doctor_name FROM appointments a
     LEFT JOIN users u ON u.id = a.doctor_id
     WHERE a.id = ? AND a.patient_id = ?`,
    [appointmentId, patientId]
  );
  if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  if (appt.status === 'cancelled') throw Object.assign(new Error('Appointment is already cancelled.'), { statusCode: 409 });
  if (appt.status === 'completed') throw Object.assign(new Error('Completed appointments cannot be cancelled.'), { statusCode: 409 });

  const reasons = {
    'schedule-conflict':  'Schedule Conflict',
    'feeling-better':     'Feeling Better',
    'personal-emergency': 'Personal Emergency',
    'cost-concerns':      'Cost Concerns',
    'other':              'Other',
  };

  await db.query(
    `UPDATE appointments SET status = 'cancelled', notes = ? WHERE id = ?`,
    [comments || reasonId, appointmentId]
  );

  // Trigger cancellation notification
  db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message) VALUES (?, 'appointment', 'Appointment Cancelled', ?)`,
    [patientId, `Your appointment with ${appt.doctor_name || 'your doctor'} has been cancelled. Reason: ${reasons[reasonId] || reasonId}.`]
  ).catch(() => {});

  return {
    appointmentId:    String(appointmentId),
    doctorName:       appt.doctor_name || 'Doctor',
    reasonLabel:      reasons[reasonId] || reasonId,
    notificationSent: false,
  };
};

module.exports = {
  getBookingOptions, getDoctorProfile, bookAppointment,
  getAppointmentsList, getAppointmentSummary,
  getRescheduleOptions, confirmReschedule,
  getCancelOptions, confirmCancel,
  generateAppointmentId,
};
