const db = require('../../config/db');

const getDashboardOverview = async (doctorId) => {
  // ── Unique patients for this doctor ──────────────────────────────────────
  const [patientRows] = await db.query(
    `SELECT DISTINCT a.patient_id,
            p.patient_name, p.phone,
            pv.blood_pressure_systolic AS systolic,
            pv.blood_pressure_diastolic AS diastolic
     FROM appointments a
     LEFT JOIN patients p ON p.id = a.patient_id
     LEFT JOIN (
       SELECT patient_id, blood_pressure_systolic, blood_pressure_diastolic
       FROM patient_vitals
       WHERE status = 'recorded' AND blood_pressure_systolic IS NOT NULL
       ORDER BY recorded_at DESC
     ) pv ON pv.patient_id = a.patient_id
     WHERE (
       a.doctor_id = ?
       OR (a.doctor_id IS NULL AND a.created_by = ? AND EXISTS (
         SELECT 1 FROM users u WHERE u.id = a.created_by AND u.role = 'doctor'
       ))
     ) AND a.status NOT IN ('cancelled', 'no-show')`,
    [doctorId, doctorId]
  );

  // Deduplicate by patient_id (keep first/latest vitals per patient)
  const seen = new Set();
  const patients = [];
  for (const r of patientRows) {
    if (!seen.has(r.patient_id)) {
      seen.add(r.patient_id);
      patients.push(r);
    }
  }

  // Classify severity
  const critical = patients.filter(p => p.systolic && p.systolic > 160);
  const warning  = patients.filter(p => p.systolic && p.systolic >= 140 && p.systolic <= 160);

  // ── Enrolled patients count ───────────────────────────────────────────────
  const [[enrolledRow]] = await db.query(
    `SELECT COUNT(DISTINCT apc.app_user_id) AS total
     FROM app_patient_careplans apc
     INNER JOIN appointments a ON a.patient_id = apc.app_user_id
     WHERE (
       a.doctor_id = ?
       OR (a.doctor_id IS NULL AND a.created_by = ? AND EXISTS (
         SELECT 1 FROM users u WHERE u.id = a.created_by AND u.role = 'doctor'
       ))
     ) AND apc.status = 'active'`,
    [doctorId, doctorId]
  );

  // ── Food logs last 24h ────────────────────────────────────────────────────
  const [[foodRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM app_meal_logs
     WHERE logged_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    []
  );

  // ── Stats tiles ───────────────────────────────────────────────────────────
  const stats = [
    { id: 'patients', value: String(patients.length),               label: 'Patients'   },
    { id: 'critical', value: String(critical.length),               label: 'Critical'   },
    { id: 'warning',  value: String(warning.length),                label: 'Warning'    },
    { id: 'messages', value: '0',                                   label: 'Messages'   },
    { id: 'enrolled', value: String(Number(enrolledRow.total) || 0), label: 'Enrolled'  },
    { id: 'foodLogs', value: String(Number(foodRow.total) || 0),    label: 'Food Logs'  },
  ];

  // ── Critical alerts ───────────────────────────────────────────────────────
  const criticalAlerts = critical.map((p, idx) => ({
    id:          `alert-${idx + 1}`,
    patientName: p.patient_name || 'Unknown',
    phoneNumber: p.phone || '',
    severity:    'critical',
    metrics: [
      { label: 'BP Systolic', value: `${p.systolic} mmHg` },
      { label: 'BP Diastolic', value: `${p.diastolic} mmHg` },
    ],
    highlightMetric: { label: 'Blood Pressure', value: `${p.systolic}/${p.diastolic} mmHg` },
  }));

  return { stats, criticalAlerts };
};

module.exports = { getDashboardOverview };
