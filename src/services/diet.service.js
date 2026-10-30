const db = require('../config/db');
const { awardPoints } = require('./rewards.service');

// ─── Static food catalog ──────────────────────────────────────────────────────
const FOOD_CATALOG = [
  { id: 'roti',         name: 'Roti',            imageUrl: '', quantityLabel: '1 piece',   calories: 70  },
  { id: 'brown-rice',   name: 'Brown Rice',       imageUrl: '', quantityLabel: '1 cup',     calories: 215 },
  { id: 'dal',          name: 'Dal (Lentil)',      imageUrl: '', quantityLabel: '1 cup',     calories: 180 },
  { id: 'paneer',       name: 'Paneer',            imageUrl: '', quantityLabel: '100g',      calories: 265 },
  { id: 'salad',        name: 'Mixed Salad',       imageUrl: '', quantityLabel: '1 bowl',    calories: 50  },
  { id: 'oats',         name: 'Oats',              imageUrl: '', quantityLabel: '1 cup',     calories: 150 },
  { id: 'banana',       name: 'Banana',            imageUrl: '', quantityLabel: '1 medium',  calories: 89  },
  { id: 'apple',        name: 'Apple',             imageUrl: '', quantityLabel: '1 medium',  calories: 95  },
  { id: 'curd',         name: 'Curd / Yoghurt',    imageUrl: '', quantityLabel: '1 cup',     calories: 100 },
  { id: 'idli',         name: 'Idli',              imageUrl: '', quantityLabel: '2 pieces',  calories: 130 },
  { id: 'poha',         name: 'Poha',              imageUrl: '', quantityLabel: '1 plate',   calories: 250 },
  { id: 'upma',         name: 'Upma',              imageUrl: '', quantityLabel: '1 plate',   calories: 220 },
  { id: 'egg-boiled',   name: 'Boiled Egg',        imageUrl: '', quantityLabel: '1 egg',     calories: 78  },
  { id: 'milk',         name: 'Milk (Low Fat)',     imageUrl: '', quantityLabel: '1 glass',   calories: 100 },
  { id: 'chicken',      name: 'Grilled Chicken',   imageUrl: '', quantityLabel: '100g',      calories: 165 },
  { id: 'fish',         name: 'Fish (Grilled)',     imageUrl: '', quantityLabel: '100g',      calories: 140 },
  { id: 'sabzi',        name: 'Vegetable Sabzi',   imageUrl: '', quantityLabel: '1 cup',     calories: 120 },
  { id: 'sprouts',      name: 'Sprouts',            imageUrl: '', quantityLabel: '1 cup',     calories: 80  },
  { id: 'fruit-bowl',   name: 'Fruit Bowl',         imageUrl: '', quantityLabel: '1 bowl',    calories: 120 },
  { id: 'green-tea',    name: 'Green Tea',          imageUrl: '', quantityLabel: '1 cup',     calories: 2   },
];

const CALORIE_ESTIMATES = {
  breakfast: 350,
  lunch:     450,
  dinner:    400,
  snack:     150,
};

const MEALS_PER_DAY_TARGET = 3;

// ─── Helper: get YYYY-MM-DD string ───────────────────────────────────────────
const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── 1. Diet Compliance ───────────────────────────────────────────────────────
const getDietCompliance = async (patientId) => {
  const today = new Date();
  const todayStr = toDateStr(today);

  // Weekly view: Mon–Sun of current week
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    weekDays.push(d);
  }

  // Fetch last 30 days of meal logs
  const [logs] = await db.query(
    `SELECT DATE(logged_at) AS log_date, COUNT(DISTINCT meal_period) AS meals_logged
     FROM app_meal_logs
     WHERE patient_id = ? AND logged_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(logged_at)`,
    [patientId]
  );

  const logMap = {};
  logs.forEach(r => { logMap[String(r.log_date).slice(0, 10)] = Number(r.meals_logged); });

  const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const weeklyView = weekDays.map(d => {
    const dateStr = toDateStr(d);
    return {
      dayLabel:     DAY_LABELS[d.getDay()],
      mealsLogged:  logMap[dateStr] || 0,
      mealsTarget:  MEALS_PER_DAY_TARGET,
      isToday:      dateStr === todayStr,
    };
  });

  // Fetch meal period logs + photos for last 7 days in parallel
  const sevenDaysAgo = toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));

  const [[periodLogsAll], [photoRows]] = await Promise.all([
    db.query(
      `SELECT DATE_FORMAT(logged_at, '%Y-%m-%d') AS log_date, meal_period
       FROM app_meal_logs
       WHERE patient_id = ? AND DATE(logged_at) BETWEEN ? AND CURDATE()`,
      [patientId, sevenDaysAgo]
    ),
    db.query(
      `SELECT meal_period, photo_url, DATE_FORMAT(uploaded_at, '%Y-%m-%d') AS photo_date
       FROM app_meal_photos
       WHERE patient_id = ? AND DATE(uploaded_at) BETWEEN ? AND CURDATE()`,
      [patientId, sevenDaysAgo]
    ),
  ]);

  // Build lookup: "YYYY-MM-DD-mealPeriod" → photoUrl
  const photoMap = {};
  photoRows.forEach(r => {
    photoMap[`${r.photo_date}-${r.meal_period}`] = r.photo_url;
  });

  // Build lookup: "YYYY-MM-DD" → Set of logged meal periods
  const periodMap = {};
  periodLogsAll.forEach(r => {
    if (!periodMap[r.log_date]) periodMap[r.log_date] = new Set();
    periodMap[r.log_date].add(r.meal_period);
  });

  // Recent history: last 7 days (including today)
  const recentHistory = [];
  for (let i = 0; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = toDateStr(d);
    const mealsLogged = logMap[dateStr] || 0;
    const loggedPeriods = periodMap[dateStr] || new Set();

    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    recentHistory.push({
      id:          dateStr,
      dateLabel,
      mealsLogged,
      mealsTarget: MEALS_PER_DAY_TARGET,
      meals: [
        { label: 'BREAKFAST', logged: loggedPeriods.has('breakfast'), photoUrl: photoMap[`${dateStr}-breakfast`] || null },
        { label: 'LUNCH',     logged: loggedPeriods.has('lunch'),     photoUrl: photoMap[`${dateStr}-lunch`]     || null },
        { label: 'DINNER',    logged: loggedPeriods.has('dinner'),    photoUrl: photoMap[`${dateStr}-dinner`]    || null },
      ],
    });
  }

  // Adherence: days in last 30 with >= target meals / 30
  const daysAdherent = logs.filter(r => Number(r.meals_logged) >= MEALS_PER_DAY_TARGET).length;
  const adherencePercent = Math.round((daysAdherent / 30) * 100);

  // Week number of year
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((today - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

  return {
    adherencePercent,
    mealsPerDayTarget: MEALS_PER_DAY_TARGET,
    trendLabel:        adherencePercent >= 80 ? 'Above average' : adherencePercent >= 50 ? 'On track' : 'Needs improvement',
    weekLabel:         `Week ${weekNum}`,
    weeklyView,
    recentHistory,
    proInsight:        'Missing just one meal log per week can impact your score by 5%. Consistency is key!',
    loggingConsistency: weeklyView.map(w => ({
      dayLabel: w.dayLabel.charAt(0),
      percent:  w.mealsLogged >= MEALS_PER_DAY_TARGET ? 100 : Math.round((w.mealsLogged / MEALS_PER_DAY_TARGET) * 100),
      isToday:  w.isToday,
    })),
  };
};

// ─── 2. Diet Chart ────────────────────────────────────────────────────────────
const getDietChart = async (patientId) => {
  const [[diet]] = await db.query(
    `SELECT id, diet_name, condition_type, calories, food_preference, language,
            weight, height, bmi, diet_content, created_at
     FROM patient_diet WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1`,
    [patientId]
  );

  if (!diet) {
    return {
      title:      'No Diet Chart Assigned',
      subtitle:   'Please visit your doctor to get a personalised diet plan.',
      schedule:   [],
      guidelines: [],
      dietContentHtml: null,
    };
  }

  // Get schedule
  const [scheduleRows] = await db.query(
    `SELECT meal_time, monday, tuesday, wednesday, thursday, friday, saturday, sunday
     FROM patient_dietschedule WHERE diet_id = ? ORDER BY id`,
    [diet.id]
  );

  // Get guidelines
  const [guidelineRows] = await db.query(
    `SELECT guideline_text FROM patient_dietguidelines WHERE diet_id = ? ORDER BY guideline_number`,
    [diet.id]
  );

  // Today's day column
  const DAY_COLS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayCol = DAY_COLS[new Date().getDay()];

  const schedule = scheduleRows.map(r => ({
    mealTime: r.meal_time,
    todayFood: r[todayCol] || null,
    allDays: {
      monday:    r.monday,
      tuesday:   r.tuesday,
      wednesday: r.wednesday,
      thursday:  r.thursday,
      friday:    r.friday,
      saturday:  r.saturday,
      sunday:    r.sunday,
    },
  }));

  return {
    title:           diet.diet_name || 'Your Personalised Diet Plan',
    subtitle:        `${diet.condition_type} • ${diet.calories} kcal • ${diet.food_preference}`,
    conditionType:   diet.condition_type,
    calories:        diet.calories,
    foodPreference:  diet.food_preference,
    language:        diet.language,
    weight:          parseFloat(diet.weight),
    height:          parseFloat(diet.height),
    bmi:             parseFloat(diet.bmi),
    schedule,
    guidelines:      guidelineRows.map(g => g.guideline_text),
    dietContentHtml: diet.diet_content,
    createdAt:       diet.created_at,
  };
};

// ─── 3. Calorie Estimate ──────────────────────────────────────────────────────
const getCalorieEstimate = async (mealPeriod) => {
  const period = (mealPeriod || '').toLowerCase();
  if (!CALORIE_ESTIMATES[period]) {
    throw Object.assign(new Error('Invalid mealPeriod. Use breakfast, lunch, dinner or snack.'), { statusCode: 400 });
  }
  return {
    mealPeriod:        period,
    estimatedCalories: CALORIE_ESTIMATES[period],
  };
};

// ─── 4. Log Meal ──────────────────────────────────────────────────────────────
const logMeal = async (patientId, { mealPeriod, hasPhoto, notes, timeLabel, estimatedCalories }) => {
  const period = (mealPeriod || '').toLowerCase();
  if (!CALORIE_ESTIMATES[period]) {
    throw Object.assign(new Error('Invalid mealPeriod. Use breakfast, lunch, dinner or snack.'), { statusCode: 400 });
  }

  const now = Date.now();
  await db.query(
    `INSERT INTO app_meal_logs (patient_id, meal_period, has_photo, notes, time_label, estimated_calories)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [patientId, period, hasPhoto ? 1 : 0, notes || null, timeLabel || null, estimatedCalories || 0]
  );

  awardPoints(patientId, 'log-meals').catch(() => {});

  // Notify assigned doctor (non-blocking)
  notifyDoctorMeal(patientId, period, estimatedCalories || 0, hasPhoto).catch(() => {});

  return {
    id:           `meal-${now}`,
    loggedAtLabel: timeLabel || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
};

const notifyDoctorMeal = async (patientId, period, calories, hasPhoto) => {
  // Find assigned doctor — check app careplans first, then clinic careplans
  let doctorId = null;
  let patientName = null;

  const [[appCareplan]] = await db.query(
    `SELECT apc.doctor_id, p.patient_name
     FROM app_patient_careplans apc
     JOIN patients p ON p.id = apc.app_user_id
     WHERE apc.app_user_id = ? AND apc.status = 'active' AND apc.doctor_id IS NOT NULL
     ORDER BY apc.created_at DESC LIMIT 1`,
    [patientId]
  );
  if (appCareplan && appCareplan.doctor_id) {
    doctorId    = appCareplan.doctor_id;
    patientName = appCareplan.patient_name;
  } else {
    // Fall back to clinic careplan
    const [[clinicCareplan]] = await db.query(
      `SELECT a.doctor_id, p.patient_name
       FROM patient_careplans pcl
       JOIN appointments a ON a.id = pcl.appointment_id
       JOIN patients p ON p.id = pcl.patient_id
       WHERE pcl.patient_id = ? AND pcl.status = 'active' AND a.doctor_id IS NOT NULL
       ORDER BY pcl.created_at DESC LIMIT 1`,
      [patientId]
    );
    if (clinicCareplan && clinicCareplan.doctor_id) {
      doctorId    = clinicCareplan.doctor_id;
      patientName = clinicCareplan.patient_name;
    }
  }

  if (!doctorId) return;

  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  const title   = 'Meal Logged';
  const message = `${patientName} logged ${periodLabel}`;

  // photo_url is set later when uploadMealPhoto is called
  await db.query(
    `INSERT INTO app_notifications (doctor_id, patient_id_ref, type, title, message, photo_url)
     VALUES (?, ?, 'meal', ?, ?, NULL)`,
    [doctorId, patientId, title, message]
  );
};

// ─── 5. Foods Catalog ─────────────────────────────────────────────────────────
const getFoodsCatalog = async (patientId) => {
  // Recent: last 10 distinct foods logged by this patient
  const [recentRows] = await db.query(
    `SELECT food_item_id FROM app_food_logs WHERE patient_id = ?
     GROUP BY food_item_id ORDER BY MAX(logged_at) DESC LIMIT 10`,
    [patientId]
  );
  const recentIds = new Set(recentRows.map(r => r.food_item_id));
  const recent = FOOD_CATALOG.filter(f => recentIds.has(f.id));

  return {
    tabs: [
      { id: 'common',    label: 'Common'    },
      { id: 'recent',    label: 'Recent'    },
      { id: 'favorites', label: 'Favorites' },
    ],
    itemsByTab: {
      common:    FOOD_CATALOG,
      recent,
      favorites: [],
    },
  };
};

// ─── 6. Foods Search ──────────────────────────────────────────────────────────
const searchFoods = async (query) => {
  if (!query || query.trim().length < 1) return [];
  const q = query.toLowerCase();
  return FOOD_CATALOG.filter(f => f.name.toLowerCase().includes(q) || f.id.includes(q));
};

// ─── 7. Log Food Item ─────────────────────────────────────────────────────────
const logFood = async (patientId, { mealPeriod, foodItemId, foodName, quantityLabel, calories }) => {
  const period = (mealPeriod || '').toLowerCase();
  if (!CALORIE_ESTIMATES[period]) {
    throw Object.assign(new Error('Invalid mealPeriod. Use breakfast, lunch, dinner or snack.'), { statusCode: 400 });
  }

  const now = Date.now();
  await db.query(
    `INSERT INTO app_food_logs (patient_id, meal_period, food_item_id, food_name, quantity_label, calories)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [patientId, period, foodItemId || '', foodName || '', quantityLabel || '', calories || 0]
  );

  return {
    id:           `food-log-${now}`,
    loggedAtLabel: foodName || '',
  };
};

// ─── Upload Meal Photo ────────────────────────────────────────────────────────
const uploadMealPhoto = async (patientId, mealPeriod, file) => {
  // Check if a photo was already uploaded for this meal period today
  const [[existing]] = await db.query(
    `SELECT id FROM app_meal_photos
     WHERE patient_id = ? AND meal_period = ? AND DATE(uploaded_at) = CURDATE()
     LIMIT 1`,
    [patientId, mealPeriod]
  );

  if (existing) {
    const fs = require('fs');
    try { fs.unlinkSync(file.path); } catch (_) {}
    throw Object.assign(
      new Error(`A photo for ${mealPeriod} has already been uploaded today.`),
      { statusCode: 409 }
    );
  }

  const photoUrl = `/uploads/meals/${file.filename}`;

  await db.query(
    `INSERT INTO app_meal_photos (patient_id, meal_period, photo_url) VALUES (?, ?, ?)`,
    [patientId, mealPeriod, photoUrl]
  );

  // Update doctor notification with the actual photo URL (non-blocking)
  db.query(
    `UPDATE app_notifications
     SET photo_url = ?
     WHERE patient_id_ref = ? AND type = 'meal' AND photo_url IS NULL
       AND DATE(created_at) = CURDATE()
       AND title LIKE ?`,
    [photoUrl, patientId, `%${mealPeriod.charAt(0).toUpperCase() + mealPeriod.slice(1)}%`]
  ).catch(() => {});

  return { photoUrl, mealPeriod };
};

module.exports = { getDietCompliance, getDietChart, getCalorieEstimate, logMeal, getFoodsCatalog, searchFoods, logFood, uploadMealPhoto };
