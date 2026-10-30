const db = require('../../config/db');

const getProgramIcon = (planName = '', planType = '') => {
  const text = `${planName} ${planType}`.toLowerCase();
  if (text.includes('diabetes') || text.includes('sugar') || text.includes('blood'))   return 'bloodtype';
  if (text.includes('heart') || text.includes('cardiac') || text.includes('cad') ||
      text.includes('hf') || text.includes('ihd'))                                      return 'favorite';
  if (text.includes('htn') || text.includes('hypertension') || text.includes('bp'))    return 'monitor-heart';
  if (text.includes('obesity') || text.includes('weight') || text.includes('fitness')) return 'fitness-center';
  if (text.includes('detox') || text.includes('cleanse'))                               return 'spa';
  return 'medical-services';
};

const formatDateLabel = (raw) => {
  if (!raw) return '';
  const d = raw instanceof Date
    ? `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,'0')}-${String(raw.getDate()).padStart(2,'0')}`
    : String(raw).slice(0, 10);
  if (!d || d.startsWith('0000') || d.length !== 10) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getEnrolledPatients = async (doctorId, { search, status, startDate, endDate, page = 1, pageSize = 20 }) => {
  const statusFilter = (status && status !== 'all') ? status : null;

  // Get doctor's branch
  const [[doctorRow]] = await db.query(`SELECT branch_id FROM users WHERE id = ? LIMIT 1`, [doctorId]);
  const branchId = doctorRow?.branch_id || null;

  // ── Source 1: App-enrolled patients (last 90 days) ───────────────────────────
  let q1 = `
    SELECT DISTINCT apc.id AS enroll_id, apc.app_user_id AS patient_id,
      apc.status, apc.created_at AS enroll_date,
      cm.care_plan_name, cm.type AS plan_type,
      p.patient_name, p.patient_id AS uhid
    FROM app_patient_careplans apc
    LEFT JOIN careplan_master cm ON cm.id = apc.plan_id
    LEFT JOIN patients p ON p.id = apc.app_user_id
    WHERE apc.doctor_id = ?`;
  const p1 = [doctorId];
  if (statusFilter) { q1 += ` AND apc.status = ?`;       p1.push(statusFilter); }
  if (startDate)    { q1 += ` AND apc.created_at >= ?`;  p1.push(startDate); }
  if (endDate)      { q1 += ` AND apc.created_at <= ?`;  p1.push(endDate); }

  // ── Source 2: Clinic care plans (last 90 days, active) ──────────────────────
  // Use explicit OR instead of COALESCE so indexes can be used
  let q2 = `
    SELECT DISTINCT pcl.id AS enroll_id, pcl.patient_id,
      pcl.status, pcl.created_at AS enroll_date,
      pcl.plan_name AS care_plan_name, pcl.plan_type,
      p.patient_name, p.patient_id AS uhid
    FROM patient_careplans pcl
    INNER JOIN appointments a ON a.id = pcl.appointment_id
    LEFT JOIN patients p ON p.id = pcl.patient_id
    WHERE (a.doctor_id = ? OR (IFNULL(a.doctor_id, 0) = 0 AND a.created_by = ?))
      AND pcl.status = 'active'`;
  const p2 = [doctorId, doctorId];
  if (startDate) { q2 += ` AND pcl.created_at >= ?`; p2.push(startDate); }
  if (endDate)   { q2 += ` AND pcl.created_at <= ?`; p2.push(endDate); }

  // Run Source 1 and Source 2 first, collect patient IDs for exclusion
  const [rows1] = await db.query(q1, p1);
  const [rows2] = await db.query(q2, p2);

  // Collect already-found patient IDs to exclude from Source 3
  const excludeIds = new Set([
    ...rows1.map(r => r.patient_id),
    ...rows2.map(r => r.patient_id),
  ]);

  // ── Source 3: Branch patients with app activity ──────────────────────────────
  const rows3 = [];
  if (branchId) {
    const excludeList = excludeIds.size > 0 ? [...excludeIds] : [0];
    const [activityRows] = await db.query(
      `SELECT DISTINCT p.id AS patient_id, p.id AS enroll_id,
         'active' AS status, NULL AS enroll_date,
         p.patient_name, p.patient_id AS uhid
       FROM patients p
       WHERE p.branch_id = ? AND p.status = 'active'
         AND p.id NOT IN (?)
         AND (
           EXISTS (SELECT 1 FROM app_chat_messages WHERE patient_id = p.id)
           OR EXISTS (SELECT 1 FROM app_vitals WHERE app_user_id = p.id)
           OR EXISTS (SELECT 1 FROM app_meal_logs WHERE patient_id = p.id)
         )`,
      [branchId, excludeList]
    );

    // Look up the latest careplan for each Source 3 patient (app careplans + clinic careplans)
    if (activityRows.length) {
      const ids = activityRows.map(r => r.patient_id);
      const [careplanRows] = await db.query(
        `SELECT patient_id,
                care_plan_name,
                plan_type,
                enroll_date
         FROM (
           SELECT apc.app_user_id AS patient_id,
                  CONVERT(COALESCE(cm.care_plan_name, apc.plan_name) USING utf8mb4) AS care_plan_name,
                  CONVERT(COALESCE(cm.type, '') USING utf8mb4) AS plan_type,
                  apc.created_at AS enroll_date
           FROM app_patient_careplans apc
           LEFT JOIN careplan_master cm ON cm.id = apc.plan_id
           WHERE apc.app_user_id IN (?)

           UNION ALL

           SELECT pcl.patient_id,
                  CONVERT(pcl.plan_name USING utf8mb4) AS care_plan_name,
                  CONVERT(COALESCE(pcl.plan_type, '') USING utf8mb4) AS plan_type,
                  pcl.created_at AS enroll_date
           FROM patient_careplans pcl
           WHERE pcl.patient_id IN (?) AND pcl.status = 'active'
         ) t
         WHERE care_plan_name IS NOT NULL AND care_plan_name != ''
         ORDER BY enroll_date DESC`,
        [ids, ids]
      );
      const careplanMap = {};
      for (const c of careplanRows) {
        if (!careplanMap[c.patient_id]) careplanMap[c.patient_id] = c;
      }

      for (const r of activityRows) {
        const cp = careplanMap[r.patient_id];
        rows3.push({
          ...r,
          care_plan_name: cp ? cp.care_plan_name : 'No care plan',
          plan_type:      cp ? cp.plan_type      : '',
          enroll_date:    cp ? cp.enroll_date    : null,
        });
      }
    }
  }

  // Merge & deduplicate by patient_id (Source 1 takes priority)
  const seen = new Set();
  let merged = [];
  for (const r of [...rows1, ...rows2, ...rows3]) {
    const pid = r.patient_id;
    if (!seen.has(pid)) {
      seen.add(pid);
      merged.push(r);
    }
  }

  // Search filter
  if (search) {
    const q = search.toLowerCase();
    merged = merged.filter(r => (r.patient_name || '').toLowerCase().includes(q));
  }

  const result = merged.map(r => {
    const name     = r.patient_name || 'Unknown';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const iconName = getProgramIcon(r.care_plan_name, r.plan_type);

    return {
      id:               `enrolled-${r.enroll_id}`,
      patientId:        `patient-${r.patient_id}`,
      patientDbId:      r.patient_id,
      name,
      initials,
      patientCode:      r.uhid || String(r.patient_id),
      programName:      r.care_plan_name || 'Care Plan',
      programIconName:  iconName,
      enrolledDateLabel: formatDateLabel(r.enroll_date),
      status:           r.status || 'active',
      statusLabel:      (r.status || 'active').charAt(0).toUpperCase() + (r.status || 'active').slice(1),
    };
  });

  const total = result.length;
  const offset = (page - 1) * pageSize;
  const paginated = result.slice(offset, offset + pageSize);

  return { totalCount: total, page, pageSize, patients: paginated };
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

  // If enrollment has a branch, update patient's branch if different (patient shifted branch)
  if (branchDbId) {
    await db.query(
      `UPDATE patients SET branch_id = ? WHERE id = ? AND (branch_id != ? OR branch_id IS NULL)`,
      [branchDbId, patientDbId, branchDbId]
    );
  }

  const enrollId = insertResult.insertId;
  const name     = patient.patient_name || 'Unknown';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const iconName = getProgramIcon(plan.care_plan_name, plan.type);
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
