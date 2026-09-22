const db = require('../../config/db');

const toDateStr = (d) => {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  return String(d).slice(0, 10);
};

const getPatientCasePaper = async (doctorId, patientId) => {
  // Access control — patient must be in the same branch as the doctor
  const [[assigned]] = await db.query(
    `SELECT p.id FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id
     WHERE p.id = ? AND u.id = ? AND p.status = 'active'
     LIMIT 1`,
    [patientId, doctorId]
  );
  if (!assigned) throw Object.assign(new Error('Access denied. Patient not assigned to this doctor.'), { statusCode: 403 });

  // Chief complaints — distinct from all appointments
  const [complaintRows] = await db.query(
    `SELECT DISTINCT chief_complaint FROM appointments
     WHERE patient_id = ? AND chief_complaint IS NOT NULL AND chief_complaint != ''
     ORDER BY appointment_date ASC`,
    [patientId]
  );

  // Comorbidities from patient_diagnosis
  const [diagRows] = await db.query(
    `SELECT DISTINCT pd.diagnosis_name, pd.diagnosis_type, pd.certainty_level
     FROM patient_diagnosis pd
     INNER JOIN appointments a ON a.id = pd.appointment_id
     WHERE a.patient_id = ? AND pd.is_selected = 1
     ORDER BY pd.created_at ASC`,
    [patientId]
  );

  // Progression — appointments with notes ordered by date ASC
  const [progressRows] = await db.query(
    `SELECT a.appointment_date, a.notes, a.chief_complaint, u.name AS doctor_name
     FROM appointments a
     LEFT JOIN users u ON u.id = a.doctor_id
     WHERE a.patient_id = ? AND (a.notes IS NOT NULL OR a.chief_complaint IS NOT NULL)
     ORDER BY a.appointment_date ASC
     LIMIT 10`,
    [patientId]
  );

  // Doctor info
  const [[doctor]] = await db.query(
    `SELECT name, specialization FROM users WHERE id = ? LIMIT 1`,
    [doctorId]
  );

  // ── Build response ─────────────────────────────────────────────────────────
  const chiefComplaints = complaintRows.map((r, i) => ({
    id:   `complaint-${i + 1}`,
    text: r.chief_complaint,
  }));

  const EMPHASIS_TYPES = ['Diabetes', 'CAD', 'HF', 'IHD', 'HTN'];
  const comorbidities = diagRows.map((d, i) => ({
    id:       `comorbidity-${i + 1}`,
    label:    d.diagnosis_name + (d.certainty_level && d.certainty_level !== 'confirmed' ? ` (${d.certainty_level})` : ''),
    emphasis: EMPHASIS_TYPES.some(t => d.diagnosis_name.toLowerCase().includes(t.toLowerCase())),
  }));

  const progression = progressRows.map((r, i) => {
    const dateStr = toDateStr(r.appointment_date);
    const [y, m] = dateStr.split('-').map(Number);
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    const text = r.notes || r.chief_complaint;
    return {
      id:          `progression-${i + 1}`,
      dateLabel:   monthLabel,
      title:       r.chief_complaint || 'Visit Note',
      description: text,
    };
  });

  const rawName = doctor?.name || '';
  const physicianName = rawName.toLowerCase().startsWith('dr') ? rawName : `Dr. ${rawName}`;
  const physicianTitle = doctor?.specialization || 'Consultant Physician';

  const [[latestAppt]] = await db.query(
    `SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS documentDate
     FROM appointments WHERE patient_id = ? AND status NOT IN ('cancelled', 'no-show')
     ORDER BY appointment_date DESC LIMIT 1`,
    [patientId]
  );
  const documentDate = latestAppt?.documentDate || null;

  return {
    documentDate,
    chiefComplaints,
    comorbidities,
    progression,
    physicianName,
    physicianTitle,
    mmcRegNo: 'MMC Reg No: N/A',
  };
};

module.exports = { getPatientCasePaper };
