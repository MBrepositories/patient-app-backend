const db = require('../../config/db');

const toTimeLabel = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getStatusVariant = (status, paidAmount, totalBill) => {
  const paid = parseFloat(paidAmount || 0);
  const total = parseFloat(totalBill || 0);
  if (paid >= total && total > 0) return 'confirmedPaid';
  if (['scheduled', 'confirmed', 'rescheduled'].includes((status || '').toLowerCase())) return 'confirmed';
  return 'pending';
};

const getStatusLabel = (variant) => {
  if (variant === 'confirmedPaid') return 'Confirmed & Paid';
  if (variant === 'confirmed') return 'Confirmed';
  return 'Pending';
};

const getDoctorSchedule = async (doctorId, { search, startDate, endDate }) => {
  let query = `
    SELECT a.id, a.appointment_date, a.appointment_time, a.appointment_type,
           a.status, a.paid_amount, a.total_bill,
           p.patient_name, p.patient_id AS uhid
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE (
      a.doctor_id = ?
      OR (a.doctor_id IS NULL AND a.created_by = ? AND EXISTS (
        SELECT 1 FROM users u WHERE u.id = a.created_by AND u.role = 'doctor'
      ))
    )
  `;
  const params = [doctorId, doctorId];

  if (startDate) { query += ` AND a.appointment_date >= ?`; params.push(startDate); }
  if (endDate)   { query += ` AND a.appointment_date <= ?`; params.push(endDate); }
  if (search)    { query += ` AND p.patient_name LIKE ?`; params.push(`%${search}%`); }

  query += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

  const [rows] = await db.query(query, params);

  const appointments = rows.map(r => {
    const dateStr = r.appointment_date instanceof Date
      ? `${r.appointment_date.getFullYear()}-${String(r.appointment_date.getMonth()+1).padStart(2,'0')}-${String(r.appointment_date.getDate()).padStart(2,'0')}`
      : String(r.appointment_date).slice(0, 10);

    const statusVariant = getStatusVariant(r.status, r.paid_amount, r.total_bill);

    return {
      id:                   String(r.id),
      patientName:          r.patient_name || 'Unknown Patient',
      uhid:                 r.uhid || '',
      isoDate:              dateStr,
      timeSlotLabel:        toTimeLabel(r.appointment_time),
      appointmentTypeLabel: r.appointment_type || 'Consultation',
      statusLabel:          getStatusLabel(statusVariant),
      statusVariant,
    };
  });

  return { totalCount: appointments.length, appointments };
};

module.exports = { getDoctorSchedule };
