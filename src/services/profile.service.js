const db = require('../config/db');

const getProfile = async (userId) => {
  const [rows] = await db.query(
    `SELECT id, name, email, phone, role,
            DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dateOfBirth,
            gender,
            health_goal  AS healthGoal,
            avatar_url   AS avatarUrl,
            is_verified  AS isVerified
     FROM app_users WHERE id = ?`,
    [userId]
  );
  if (!rows.length) {
    const err = new Error('User not found.'); err.statusCode = 404; throw err;
  }
  return rows[0];
};

const updateProfile = async (userId, data) => {
  const { name, email, phone, dateOfBirth, gender, healthGoal } = data;
  await db.query(
    `UPDATE app_users
     SET name = ?, email = ?, phone = ?, date_of_birth = ?, gender = ?, health_goal = ?
     WHERE id = ?`,
    [name, email.toLowerCase(), phone || null, dateOfBirth || null, gender || null, healthGoal || null, userId]
  );
  return getProfile(userId);
};

module.exports = { getProfile, updateProfile };
