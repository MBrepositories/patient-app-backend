const db = require('../config/db');

const getProfile = async (userId, role) => {
  if (role === 'patient') {
    const [rows] = await db.query(
      `SELECT
         id, patient_id AS patientId, patient_name AS name, phone, email, gender,
         DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dateOfBirth,
         age, blood_group AS bloodGroup, address, city, district, pincode,
         photo_path AS avatarUrl, branch_id AS branchId
       FROM patients WHERE id = ? AND status = 'active'`,
      [userId]
    );
    if (!rows.length) {
      const err = new Error('Patient not found.'); err.statusCode = 404; throw err;
    }
    return rows[0];
  }

  if (role === 'doctor') {
    const [rows] = await db.query(
      `SELECT id, name, first_name AS firstName, last_name AS lastName,
              phone, email, gender, role,
              drdegree AS degree, drregistration AS registration
       FROM users WHERE id = ? AND status = 'active'`,
      [userId]
    );
    if (!rows.length) {
      const err = new Error('User not found.'); err.statusCode = 404; throw err;
    }
    return rows[0];
  }

  const err = new Error('Invalid role.'); err.statusCode = 400; throw err;
};

const updateProfile = async (userId, role, data) => {
  if (role === 'patient') {
    const { name, email, dateOfBirth, gender } = data;
    const parts = (name || '').trim().split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    await db.query(
      `UPDATE patients
       SET patient_name = ?, first_name = ?, last_name = ?,
           email = ?, date_of_birth = ?, gender = ?
       WHERE id = ?`,
      [name, firstName, lastName, email ? email.toLowerCase() : null, dateOfBirth || null, gender || null, userId]
    );
  } else if (role === 'doctor') {
    const { name, email, gender } = data;
    await db.query(
      'UPDATE users SET name = ?, email = ?, gender = ? WHERE id = ?',
      [name, email ? email.toLowerCase() : null, gender || null, userId]
    );
  }
  return getProfile(userId, role);
};

module.exports = { getProfile, updateProfile };
