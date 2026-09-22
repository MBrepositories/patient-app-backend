const axios = require('axios');
const appleSignin = require('apple-signin-auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

const generatePatientCode = async () => {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `MB${year}`;
  const [rows] = await db.query(
    'SELECT patient_id FROM patients WHERE patient_id LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );
  const lastNum = rows.length ? parseInt(rows[0].patient_id.slice(4)) : 0;
  return prefix + String(lastNum + 1).padStart(4, '0');
};

// ─── Verify Google ID token ───────────────────────────────────────────────────
const verifyGoogleToken = async (idToken) => {
  const { data } = await axios.get(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );
  if (!data.email || !data.email_verified) {
    throw Object.assign(new Error('Google token is invalid or email not verified.'), { statusCode: 401 });
  }
  return {
    email:    data.email,
    name:     data.name || data.email.split('@')[0],
    googleId: data.sub,
  };
};

// ─── Verify Apple identity token ─────────────────────────────────────────────
const verifyAppleToken = async (idToken) => {
  const payload = await appleSignin.verifyIdToken(idToken, {
    audience:          process.env.APPLE_CLIENT_ID || 'com.madhavbaug.patient',
    ignoreExpiration:  false,
  });
  if (!payload.email) {
    throw Object.assign(new Error('Apple token did not return an email.'), { statusCode: 401 });
  }
  return {
    email:   payload.email,
    name:    payload.name || payload.email.split('@')[0],
    appleId: payload.sub,
  };
};

// ─── Social Login ─────────────────────────────────────────────────────────────
const socialLogin = async ({ provider, idToken, role }) => {
  // 1. Verify token with provider
  let profile;
  if (provider === 'google') {
    profile = await verifyGoogleToken(idToken);
  } else if (provider === 'apple') {
    profile = await verifyAppleToken(idToken);
  } else {
    throw Object.assign(new Error('Invalid provider. Use google or apple.'), { statusCode: 400 });
  }

  const { email, name, googleId, appleId } = profile;
  const socialField = provider === 'google' ? 'google_id' : 'apple_id';
  const socialId    = provider === 'google' ? googleId : appleId;

  // 2. Patient flow
  if (role === 'patient') {
    // Try to find existing patient by social ID first, then by email
    let [[patient]] = await db.query(
      `SELECT id, patient_id, patient_name, phone, email FROM patients WHERE ${socialField} = ? LIMIT 1`,
      [socialId]
    );

    if (!patient && email) {
      [[patient]] = await db.query(
        `SELECT id, patient_id, patient_name, phone, email FROM patients WHERE email = ? AND status = 'active' LIMIT 1`,
        [email.toLowerCase()]
      );
      // Link social ID to existing patient
      if (patient) {
        await db.query(`UPDATE patients SET ${socialField} = ? WHERE id = ?`, [socialId, patient.id]);
      }
    }

    // Auto-register new patient if not found
    if (!patient) {
      const patientCode = await generatePatientCode();
      const nameParts   = name.trim().split(' ');
      const firstName   = nameParts[0];
      const lastName    = nameParts.slice(1).join(' ') || '';
      const fullName    = name.trim();

      const [result] = await db.query(
        `INSERT INTO patients
           (user_id, branch_id, created_by, patient_id, first_name, last_name, patient_name,
            email, ${socialField}, app_registered_at, created_at, status)
         VALUES (1, 1, 1, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'active')`,
        [patientCode, firstName, lastName, fullName, email ? email.toLowerCase() : null, socialId]
      );
      const [newRows] = await db.query('SELECT id, patient_id, patient_name, phone, email FROM patients WHERE id = ?', [result.insertId]);
      patient = newRows[0];
    }

    const payload = { id: patient.id, patientId: patient.patient_id, role: 'patient' };
    return {
      token: generateToken(payload),
      user: {
        id:        patient.id,
        patientId: patient.patient_id,
        name:      patient.patient_name,
        phone:     patient.phone || null,
        email:     patient.email || null,
        role:      'patient',
      },
    };
  }

  // 3. Doctor flow — doctors must already exist, no auto-register
  if (role === 'doctor') {
    let [[doctor]] = await db.query(
      `SELECT id, name, first_name, last_name, phone, email FROM users WHERE ${socialField} = ? AND status = 'active' LIMIT 1`,
      [socialId]
    );

    if (!doctor && email) {
      [[doctor]] = await db.query(
        `SELECT id, name, first_name, last_name, phone, email FROM users WHERE email = ? AND status = 'active' LIMIT 1`,
        [email.toLowerCase()]
      );
      if (doctor) {
        await db.query(`UPDATE users SET ${socialField} = ? WHERE id = ?`, [socialId, doctor.id]);
      }
    }

    if (!doctor) {
      throw Object.assign(
        new Error('No doctor account found for this email. Please contact your administrator.'),
        { statusCode: 404 }
      );
    }

    const payload = { id: doctor.id, role: 'doctor' };
    return {
      token: generateToken(payload),
      user: {
        id:    doctor.id,
        name:  doctor.name || `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim(),
        phone: doctor.phone || null,
        email: doctor.email || null,
        role:  'doctor',
      },
    };
  }

  throw Object.assign(new Error('Invalid role. Use patient or doctor.'), { statusCode: 400 });
};

module.exports = { socialLogin };
