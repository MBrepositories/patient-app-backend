const db = require('../config/db');
const { awardPoints } = require('./rewards.service');

const SYMPTOMS = [
  { id: 'headaches', label: 'Headaches' },
  { id: 'dizziness', label: 'Dizziness' },
  { id: 'fatigue',   label: 'Fatigue'   },
];

const MOODS = [
  { id: 'very-bad', emoji: '😢', label: 'Poor',   description: 'Struggling to get through daily tasks and feeling drained.' },
  { id: 'bad',      emoji: '😟', label: 'Unwell', description: 'Low energy and finding it hard to stay on top of things.' },
  { id: 'okay',     emoji: '😐', label: 'Okay',   description: 'Managing day-to-day, with some ups and downs.' },
  { id: 'good',     emoji: '😊', label: 'Good',   description: 'Feeling positive and capable of managing daily tasks without fatigue.' },
  { id: 'great',    emoji: '🤩', label: 'Great',  description: 'Energized and feeling on top of your health this week.' },
];

const getCurrentWeekInfo = () => {
  const now = new Date();
  const year = now.getFullYear();

  // ISO week number
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);

  const weekLabel = `Week ${weekNumber}`;
  const dateRangeLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return { year, weekNumber, weekLabel, dateRangeLabel };
};

const getSurvey = async (patientId) => {
  const { year, weekNumber, weekLabel, dateRangeLabel } = getCurrentWeekInfo();

  // Get last submission for this patient (current week if exists)
  const [rows] = await db.query(
    `SELECT symptoms, mood_id FROM app_survey_submissions
     WHERE app_user_id = ? AND year = ? AND week_number = ?
     ORDER BY created_at DESC LIMIT 1`,
    [patientId, year, weekNumber]
  );

  const lastSubmission = rows[0] || null;
  const submittedSymptoms = lastSubmission
    ? (typeof lastSubmission.symptoms === 'string'
        ? JSON.parse(lastSubmission.symptoms)
        : lastSubmission.symptoms)
    : [];

  // Merge submitted values into symptoms list
  const symptoms = SYMPTOMS.map(s => {
    const submitted = submittedSymptoms.find(ss => ss.id === s.id);
    return { ...s, value: submitted ? submitted.value : 0 };
  });

  return {
    weekLabel,
    dateRangeLabel,
    symptoms,
    moods: MOODS,
    selectedMoodId: lastSubmission ? lastSubmission.mood_id : null,
    rewardPoints: 15,
  };
};

const submitSurvey = async (patientId, { symptoms, moodId }) => {
  const { year, weekNumber } = getCurrentWeekInfo();

  // Check if already submitted this week
  const [existing] = await db.query(
    'SELECT id FROM app_survey_submissions WHERE app_user_id = ? AND year = ? AND week_number = ? LIMIT 1',
    [patientId, year, weekNumber]
  );
  if (existing.length) {
    const err = new Error('You have already submitted the survey for this week.');
    err.statusCode = 409;
    throw err;
  }

  await db.query(
    `INSERT INTO app_survey_submissions (app_user_id, week_number, year, symptoms, mood_id, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [patientId, weekNumber, year, JSON.stringify(symptoms), moodId]
  );

  // Award points for weekly survey (once per week, handled by awardPoints daily dedup — ok here)
  awardPoints(patientId, 'survey', 'Weekly survey submitted').catch(() => {});
};

module.exports = { getSurvey, submitSurvey };
