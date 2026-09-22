const getActivityMenu = () => {
  return {
    options: [
      {
        id: 'vitals',
        title: 'Log Vitals',
        subtitle: 'Record blood pressure, blood sugar, or heart rate.',
        iconName: 'favorite',
        iconColor: '#E63950',
        iconBackground: '#E639501A',
        chips: ['Blood Pressure', 'Sugar'],
      },
      {
        id: 'meal',
        title: 'Log Meal',
        subtitle: 'Track your nutrition and stay on top of your diet plan.',
        iconName: 'restaurant',
        iconColor: '#4C6FFF',
        iconBackground: '#4C6FFF1A',
        chips: ['Breakfast', 'Lunch', 'Dinner'],
      },
      {
        id: 'exercise',
        title: 'Log Exercise',
        subtitle: 'Stay active and complete your daily exercise goals.',
        iconName: 'fitness-center',
        iconColor: '#F2994A',
        iconBackground: '#F2994A1A',
        chips: ['Walk', 'Gym', 'Yoga'],
      },
      {
        id: 'medication',
        title: 'Medication Adherence',
        subtitle: 'Ensure your treatment plan stays on track.',
        iconName: 'medical-services',
        iconColor: '#E63950',
        iconBackground: '#E639501A',
        chips: ['Daily Dose'],
      },
    ],
    tip: 'Logging right after the activity increases accuracy and helps build a sustainable habit.',
  };
};

module.exports = { getActivityMenu };
