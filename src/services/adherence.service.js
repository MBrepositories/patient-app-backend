const db = require('../config/db');

const get7DayAdherence = async (patientId) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6); // last 7 days inclusive of today
  const fromStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth()+1).padStart(2,'0')}-${String(sevenDaysAgo.getDate()).padStart(2,'0')}`;

  // ── Diet: count distinct meal_period logs per day (target: 3/day × 7 = 21) ─
  const [[dietRow]] = await db.query(
    `SELECT COUNT(DISTINCT CONCAT(DATE(logged_at), '-', meal_period)) AS meals_logged
     FROM app_meal_logs
     WHERE patient_id = ? AND DATE(logged_at) BETWEEN ? AND ?`,
    [patientId, fromStr, todayStr]
  );
  const mealsLogged  = Number(dietRow.meals_logged) || 0;
  const mealsTarget  = 21;
  const dietPercent  = Math.min(100, Math.round((mealsLogged / mealsTarget) * 100));

  // ── Exercise: distinct days with completed session (target: 7 days) ─────────
  const [[exRow]] = await db.query(
    `SELECT COUNT(DISTINCT DATE(created_at)) AS days_done
     FROM app_exercise_sessions
     WHERE app_user_id = ? AND DATE(created_at) BETWEEN ? AND ?
       AND compliance_status = 'completed'`,
    [patientId, fromStr, todayStr]
  );
  const daysDone      = Number(exRow.days_done) || 0;
  const exerciseTarget = 7;
  const exercisePercent = Math.min(100, Math.round((daysDone / exerciseTarget) * 100));

  // ── Medicine: doses taken (target: 3 slots/day × 7 = 21) ─────────────────
  const [[medRow]] = await db.query(
    `SELECT COUNT(*) AS doses_taken
     FROM app_medicine_logs
     WHERE app_user_id = ? AND DATE(logged_at) BETWEEN ? AND ? AND taken = 1
       AND slot IN ('morning','afternoon','night')`,
    [patientId, fromStr, todayStr]
  );
  const dosesTaken   = Number(medRow.doses_taken) || 0;
  const dosesTarget  = 21;
  const medPercent   = Math.min(100, Math.round((dosesTaken / dosesTarget) * 100));

  // ── Overall: average of 3 categories ─────────────────────────────────────
  const overallPercent = Math.round((dietPercent + exercisePercent + medPercent) / 3);

  const progressLabel = overallPercent >= 80 ? 'Good Progress'
    : overallPercent >= 50 ? 'On Track'
    : 'Needs Improvement';

  // ── Dynamic health insight ────────────────────────────────────────────────
  const lowestCategory = [
    { id: 'diet',     percent: dietPercent },
    { id: 'exercise', percent: exercisePercent },
    { id: 'medicine', percent: medPercent },
  ].sort((a, b) => a.percent - b.percent)[0];

  const insightMap = {
    diet:     'Logging all your meals today will improve your diet compliance score.',
    exercise: 'Completing your exercise today will boost your weekly compliance.',
    medicine: 'Taking your remaining doses today will bring your medicine adherence up.',
  };
  const healthInsight = insightMap[lowestCategory.id];

  // ── Summary message ───────────────────────────────────────────────────────
  const summaryMessage = overallPercent >= 80
    ? "You're doing great! Keep up the consistency with your health routine."
    : overallPercent >= 50
    ? "You're on track. A little more effort will make a big difference this week."
    : "Let's get back on track. Small consistent steps lead to big results!";

  return {
    overallPercent,
    progressLabel,
    summaryMessage,
    categories: [
      {
        id:          'diet',
        label:       'Diet Compliance',
        detailLabel: `${mealsLogged}/${mealsTarget} meals logged`,
        percent:     dietPercent,
      },
      {
        id:          'exercise',
        label:       'Exercise Compliance',
        detailLabel: `${daysDone}/${exerciseTarget} days completed`,
        percent:     exercisePercent,
      },
      {
        id:          'medicine',
        label:       'Medicine Adherence',
        detailLabel: `${dosesTaken}/${dosesTarget} doses taken`,
        percent:     medPercent,
      },
    ],
    healthInsight,
    syncTitle:       'PowerMAP Synchronization',
    syncDescription: 'Scores are calculated based on your activity logs for the last 7 days.',
    lastSyncedLabel: 'Last synced: just now',
  };
};

module.exports = { get7DayAdherence };
