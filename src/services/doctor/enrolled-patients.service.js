const db = require('../../config/db');

const PROGRAM_ICON = {
  'Diabetes': 'bloodtype',
  'CAD':      'favorite',
  'HF':       'favorite',
  'IHD':      'favorite',
  'HTN':      'monitor-heart',
  'Obesity':  'fitness-center',
};

const getEnrolledPatients = async (doctorId, { search, status, startDate, endDate }) => {
  const conditions = [];
  const params = [doctorId, doctorId];

  if (status && status !== 'all') {
    conditions.push('apc.status = ?');
    params.push(status);
  }

  if (startDate) {
    conditions.push('apc.start_date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('apc.start_date <= ?');
    params.push(endDate);
  }

  const whereExtra = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT DISTINCT
       apc.id AS enroll_id,
       apc.app_user_id,
       apc.status,
       apc.start_date,
       cm.care_plan_name,
       cm.type AS plan_type,
       p.patient_name,
       p.patient_id AS uhid
     FROM app_patient_careplans apc
     INNER JOIN users u ON u.id = ?
     LEFT JOIN careplan_master cm ON cm.id = apc.plan_id
     LEFT JOIN patients p ON p.id = apc.app_user_id
     WHERE (
       apc.doctor_id = ?
       OR (apc.doctor_id IS NULL AND p.branch_id = u.branch_id AND u.clinic_head = 1)
     )
     ${whereExtra}
     ORDER BY apc.created_at DESC`,
    params
  );

  // Search filter
  let patients = rows;
  if (search) {
    const q = search.toLowerCase();
    patients = patients.filter(r => (r.patient_name || '').toLowerCase().includes(q));
  }

  const result = patients.map(r => {
    const name     = r.patient_name || 'Unknown';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const planType = r.plan_type || '';
    const iconName = PROGRAM_ICON[planType] || 'medical-services';

    // Safe date parsing
    let enrolledDateLabel = '';
    const rawDate = r.start_date instanceof Date
      ? `${r.start_date.getFullYear()}-${String(r.start_date.getMonth()+1).padStart(2,'0')}-${String(r.start_date.getDate()).padStart(2,'0')}`
      : String(r.start_date || '').slice(0, 10);
    if (rawDate && !rawDate.startsWith('0000') && rawDate.length === 10) {
      const [y, m, d] = rawDate.split('-').map(Number);
      enrolledDateLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);

    return {
      id:               `enrolled-${r.enroll_id}`,
      patientId:        `patient-${r.app_user_id}`,
      patientDbId:      r.app_user_id,
      name,
      initials,
      patientCode:      r.uhid || String(r.app_user_id),
      programName:      r.care_plan_name || 'Care Plan',
      programIconName:  iconName,
      enrolledDateLabel,
      status:           r.status,
      statusLabel,
    };
  });

  return { totalCount: result.length, patients: result };
};

// ── Search patients by phone or UHID ─────────────────────────────────────────
const searchPatients = async (query) => {
  if (!query || !query.trim()) {
    const err = new Error('query param is required');
    err.statusCode = 400;
    throw err;
  }

  const q = query.trim();
  const [rows] = await db.query(
    `SELECT id, patient_name, patient_id AS uhid, phone, gender, age
     FROM patients
     WHERE phone = ? OR id = ?
     LIMIT 10`,
    [q, q]
  );

  const results = rows.map(r => {
    const name     = r.patient_name || 'Unknown';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const parts = [];
    if (r.age)    parts.push(`${r.age} yrs`);
    if (r.gender) parts.push(r.gender.charAt(0).toUpperCase() + r.gender.slice(1));
    return {
      patientId:    `patient-${r.id}`,
      patientDbId:  r.id,
      name,
      initials,
      patientCode:  r.uhid || String(r.id),
      phone:        r.phone || '',
      ageGenderLabel: parts.join(' / ') || '',
    };
  });

  return { totalCount: results.length, patients: results };
};

// ── Enroll patient into a care plan ──────────────────────────────────────────
const enrollPatient = async (doctorId, { patientId, planId, branchId }) => {
  // Parse patient numeric id from "patient-1176054" format or raw number
  const patientDbId = typeof patientId === 'string'
    ? parseInt(patientId.replace('patient-', ''), 10)
    : parseInt(patientId, 10);

  const branchDbId = branchId
    ? (typeof branchId === 'string' ? parseInt(branchId.replace('branch-', ''), 10) : parseInt(branchId, 10))
    : null;

  if (!patientDbId || !planId) {
    const err = new Error('patientId and planId are required');
    err.statusCode = 400;
    throw err;
  }

  // Check patient exists and is active
  const [[patient]] = await db.query(
    `SELECT id, patient_name, patient_id AS uhid FROM patients WHERE id = ? AND status = 'active'`,
    [patientDbId]
  );
  if (!patient) {
    const err = new Error('Patient not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  // Get care plan info
  const [[plan]] = await db.query(
    `SELECT id, care_plan_name, type FROM careplan_master WHERE id = ?`,
    [planId]
  );
  if (!plan) {
    const err = new Error('Care plan not found');
    err.statusCode = 404;
    throw err;
  }

  // Complete any existing active enrollment for same patient+plan
  await db.query(
    `UPDATE app_patient_careplans SET status = 'completed', updated_at = NOW()
     WHERE app_user_id = ? AND plan_id = ? AND status = 'active'`,
    [patientDbId, planId]
  );

  // Insert new enrollment
  const today = new Date().toISOString().slice(0, 10);
  const [insertResult] = await db.query(
    `INSERT INTO app_patient_careplans (app_user_id, plan_id, plan_name, status, start_date, branch_id, doctor_id, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, NOW(), NOW())`,
    [patientDbId, planId, plan.care_plan_name || '', today, branchDbId || null, doctorId]
  );

  const enrollId = insertResult.insertId;
  const name     = patient.patient_name || 'Unknown';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const planType = plan.type || '';
  const iconName = PROGRAM_ICON[planType] || 'medical-services';
  const enrolledDateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    id:               `enrolled-${enrollId}`,
    patientId:        `patient-${patientDbId}`,
    patientDbId,
    name,
    initials,
    patientCode:      patient.uhid || String(patientDbId),
    programName:      plan.care_plan_name || 'Care Plan',
    programIconName:  iconName,
    enrolledDateLabel,
    status:           'active',
    statusLabel:      'Active',
  };
};

module.exports = { getEnrolledPatients, searchPatients, enrollPatient };
