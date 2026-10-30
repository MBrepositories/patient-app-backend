const db = require('../../config/db');

const getDashboardOverview = async (doctorId) => {
  // ── Get doctor's branch ───────────────────────────────────────────────────
  const [[doctorRow]] = await db.query(`SELECT branch_id FROM users WHERE id = ? LIMIT 1`, [doctorId]);
  const branchId = doctorRow?.branch_id || null;

  // ── Collect all patient IDs for this doctor (same logic as enrolled-patients) ──
  // Source 1: app_patient_careplans
  const [rows1] = await db.query(
    `SELECT DISTINCT apc.app_user_id AS patient_id
     FROM app_patient_careplans apc
     WHERE apc.doctor_id = ?`,
    [doctorId]
  );

  // Source 2: clinic patient_careplans via appointments
  const [rows2] = await db.query(
    `SELECT DISTINCT pcl.patient_id
     FROM patient_careplans pcl
     INNER JOIN appointments a ON a.id = pcl.appointment_id
     WHERE (a.doctor_id = ? OR (IFNULL(a.doctor_id, 0) = 0 AND a.created_by = ?))
       AND pcl.status = 'active'`,
    [doctorId, doctorId]
  );

  const knownIds = new Set([...rows1.map(r => r.patient_id), ...rows2.map(r => r.patient_id)]);

  // Source 3: branch patients with app activity
  let rows3 = [];
  if (branchId) {
    const excludeList = knownIds.size > 0 ? [...knownIds] : [0];
    const [activityRows] = await db.query(
      `SELECT DISTINCT p.id AS patient_id
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
    rows3 = activityRows;
  }

  const allPatientIds = [...new Set([...rows1, ...rows2, ...rows3].map(r => r.patient_id))];
  const totalPatients = allPatientIds.length;

  // ── Get latest vitals for critical/warning classification ─────────────────
  let critical = [], warning = [];
  if (allPatientIds.length > 0) {
    const [vitalRows] = await db.query(
      `SELECT pv.patient_id, pv.blood_pressure_systolic AS systolic,
              pv.blood_pressure_diastolic AS diastolic,
              p.patient_name, p.phone
       FROM patient_vitals pv
       JOIN patients p ON p.id = pv.patient_id
       WHERE pv.patient_id IN (?)
         AND pv.status = 'recorded'
         AND pv.blood_pressure_systolic IS NOT NULL
       ORDER BY pv.recorded_at DESC`,
      [allPatientIds]
    );
    // Keep only latest per patient
    const seen = new Set();
    const latestVitals = [];
    for (const r of vitalRows) {
      if (!seen.has(r.patient_id)) { seen.add(r.patient_id); latestVitals.push(r); }
    }
    critical = latestVitals.filter(p => p.systolic > 160);
    warning  = latestVitals.filter(p => p.systolic >= 140 && p.systolic <= 160);
  }

  // ── Enrolled count (active app careplans for this doctor's patients) ──────
  const [[enrolledRow]] = await db.query(
    `SELECT COUNT(DISTINCT app_user_id) AS total
     FROM app_patient_careplans
     WHERE doctor_id = ? AND status = 'active'`,
    [doctorId]
  );

  // ── Unread messages count ─────────────────────────────────────────────────
  const [[msgRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM app_chat_messages
     WHERE sender = 'patient' AND status != 'read'
       AND patient_id IN (${allPatientIds.length > 0 ? '?' : 'SELECT NULL'})`,
    allPatientIds.length > 0 ? [allPatientIds] : []
  );

  // ── Food logs last 24h for doctor's patients ──────────────────────────────
  const [[foodRow]] = allPatientIds.length > 0
    ? await db.query(
        `SELECT COUNT(*) AS total FROM app_meal_logs
         WHERE logged_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
           AND patient_id IN (?)`,
        [allPatientIds]
      )
    : [[{ total: 0 }]];

  // ── Stats tiles ───────────────────────────────────────────────────────────
  const stats = [
    { id: 'patients', value: String(totalPatients),                     label: 'Patients'  },
    { id: 'critical', value: String(critical.length),                   label: 'Critical'  },
    { id: 'warning',  value: String(warning.length),                    label: 'Warning'   },
    { id: 'messages', value: String(Number(msgRow?.total) || 0),        label: 'Messages'  },
    { id: 'enrolled', value: String(Number(enrolledRow.total) || 0),    label: 'Enrolled'  },
    { id: 'foodLogs', value: String(Number(foodRow?.total) || 0),       label: 'Food Logs' },
  ];

  // ── Critical alerts ───────────────────────────────────────────────────────
  const criticalAlerts = critical.map((p, idx) => ({
    id:          `alert-${idx + 1}`,
    patientName: p.patient_name || 'Unknown',
    phoneNumber: p.phone || '',
    severity:    'critical',
    metrics: [
      { label: 'BP Systolic',  value: `${p.systolic} mmHg`  },
      { label: 'BP Diastolic', value: `${p.diastolic} mmHg` },
    ],
    highlightMetric: { label: 'Blood Pressure', value: `${p.systolic}/${p.diastolic} mmHg` },
  }));

  return { stats, criticalAlerts };
};

module.exports = { getDashboardOverview };
