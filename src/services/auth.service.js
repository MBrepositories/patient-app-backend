const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendOtp: sendOtpService, verifyOtp: verifyOtpService, checkRecentlyVerified } = require('./otp.service');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
};

// ─── Patient helpers ──────────────────────────────────────────────────────────

const generatePatientCode = async () => {
  const year = new Date().getFullYear().toString().slice(-2); // e.g. "26"
  const prefix = `MB${year}`;
  const [rows] = await db.query(
    'SELECT patient_id FROM patients WHERE patient_id LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );
  const lastNum = rows.length ? parseInt(rows[0].patient_id.slice(4)) : 0;
  return prefix + String(lastNum + 1).padStart(4, '0');
};

const formatPatient = (p) => ({
  id: p.id,
  patientId: p.patient_id,
  name: p.patient_name,
  phone: p.phone,
  email: p.email || null,
  role: 'patient',
});

const findPatientsByPhone = async (phone) => {
  const [rows] = await db.query(
    `SELECT id, patient_id, patient_name, phone, email, app_password, app_registered_at
     FROM patients WHERE phone = ? AND status = 'active'`,
    [phone]
  );
  return rows;
};

const findPatientsByEmail = async (email) => {
  const [rows] = await db.query(
    `SELECT id, patient_id, patient_name, phone, email, app_password, app_registered_at
     FROM patients WHERE email = ? AND status = 'active'`,
    [email.toLowerCase()]
  );
  return rows;
};

// ─── Doctor helpers ───────────────────────────────────────────────────────────

const generateUsername = async (email) => {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  let username = base;
  let counter = 1;
  while (true) {
    const [[existing]] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (!existing) break;
    username = `${base}${counter}`;
    counter++;
  }
  return username;
};

const formatDoctor = (u) => ({
  id: u.id,
  name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
  phone: u.phone,
  email: u.email,
  role: 'doctor',
});

const findDoctorByPhone = async (phone) => {
  const [rows] = await db.query(
    `SELECT id, username, name, first_name, last_name, phone, email, app_password, app_registered_at, is_active
     FROM users WHERE phone = ? LIMIT 1`,
    [phone]
  );
  if (!rows[0]) return null;
  if (!rows[0].is_active) {
    const err = new Error('Your account is inactive. Please contact your administrator.');
    err.statusCode = 403;
    throw err;
  }
  return rows[0];
};

const findDoctorByEmail = async (email) => {
  const [rows] = await db.query(
    `SELECT id, username, name, first_name, last_name, phone, email, app_password, app_registered_at, is_active
     FROM users WHERE email = ? LIMIT 1`,
    [email.toLowerCase()]
  );
  if (!rows[0]) return null;
  if (!rows[0].is_active) {
    const err = new Error('Your account is inactive. Please contact your administrator.');
    err.statusCode = 403;
    throw err;
  }
  return rows[0];
};

// ─── Register ────────────────────────────────────────────────────────────────

const register = async ({ role, firstName, middleName, lastName, name, email, phone, gender, password, branchId }) => {
  const passwordHash = await bcrypt.hash(password, 12);

  if (role === 'patient') {
    // Check email uniqueness first (if provided)
    if (email) {
      const byEmail = await findPatientsByEmail(email);
      const alreadyRegistered = byEmail.find((p) => p.app_password);
      if (alreadyRegistered) {
        const err = new Error('This email is already registered in the app.'); err.statusCode = 409; throw err;
      }
    }

    const patients = await findPatientsByPhone(phone);

    if (patients.length === 1 && patients[0].app_password) {
      const err = new Error('This phone number is already registered in the app.'); err.statusCode = 409; throw err;
    }

    let patient;

    if (patients.length === 1 && !patients[0].app_password) {
      // Existing hospital patient — set app credentials
      await db.query(
        'UPDATE patients SET app_password = ?, app_registered_at = NOW() WHERE id = ?',
        [passwordHash, patients[0].id]
      );
      const [updated] = await db.query('SELECT * FROM patients WHERE id = ?', [patients[0].id]);
      patient = updated[0];
    } else if (patients.length === 0) {
      // New patient — create record in patients table
      const patientCode = await generatePatientCode();
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      const [result] = await db.query(
        `INSERT INTO patients
           (user_id, branch_id, created_by, patient_id, first_name, middle_name, last_name, patient_name,
            gender, phone, email, app_password, app_registered_at, created_at, status)
         VALUES (1, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'active')`,
        [branchId, patientCode, firstName, middleName || '', lastName, fullName, gender, phone, email || null, passwordHash]
      );
      const [newRows] = await db.query('SELECT * FROM patients WHERE id = ?', [result.insertId]);
      patient = newRows[0];
    } else {
      // Multiple patients with same phone — cannot auto-register
      const err = new Error('Multiple records found for this phone number. Please contact the clinic to set up your app account.');
      err.statusCode = 409;
      throw err;
    }

    const payload = { id: patient.id, patientId: patient.patient_id, role: 'patient' };
    return { token: generateToken(payload), user: formatPatient(patient) };
  }

  if (role === 'doctor') {
    const [byEmail, byPhone] = await Promise.all([
      findDoctorByEmail(email),
      findDoctorByPhone(phone),
    ]);

    if (byEmail) {
      const err = new Error('An account with this email already exists. Please login with OTP.'); err.statusCode = 409; throw err;
    }
    if (byPhone) {
      const err = new Error('An account with this phone number already exists. Please login with OTP.'); err.statusCode = 409; throw err;
    }

    // Create new doctor in users table
    const username = await generateUsername(email);
    const nameParts = name.trim().split(' ');
    const first = nameParts[0];
    const last = nameParts.slice(1).join(' ') || '';
    const [result] = await db.query(
      `INSERT INTO users
         (username, branch_id, name, first_name, last_name, email, phone, gender, role,
          password, app_password, app_registered_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'doctor', ?, ?, NOW(), 'active', NOW())`,
      [username, branchId, name, first, last, email.toLowerCase(), phone, gender, password, passwordHash]
    );
    const [newRows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const doctor = newRows[0];

    // Grant branch access so the doctor only sees their branch in the web software
    if (branchId) {
      try {
        await db.query(
          'INSERT INTO user_branch_access (user_id, branch_id) VALUES (?, ?)',
          [result.insertId, branchId]
        );
      } catch (e) {
        // Non-fatal — doctor account is created successfully even if this fails
        console.error('Failed to insert user_branch_access for doctor:', e.message);
      }
    }

    const payload = { id: doctor.id, role: 'doctor' };
    return { token: generateToken(payload), user: formatDoctor(doctor) };
  }
};

// ─── Send OTP (login initiation) ─────────────────────────────────────────────

const sendOtp = async ({ role, channel, target }) => {
  let userId = 0;

  if (role === 'patient') {
    const patients = channel === 'phone'
      ? await findPatientsByPhone(target)
      : await findPatientsByEmail(target);

    if (patients.length === 0) {
      const err = new Error(`No account found with this ${channel}.`); err.statusCode = 404; throw err;
    }
    // If multiple patients share the phone, use 0 as placeholder — resolved at verify step
    userId = patients.length === 1 ? patients[0].id : 0;
  } else {
    const doctor = channel === 'phone'
      ? await findDoctorByPhone(target)
      : await findDoctorByEmail(target);

    if (!doctor) {
      const err = new Error(`No account found with this ${channel}.`); err.statusCode = 404; throw err;
    }
    userId = doctor.id;
  }

  await sendOtpService(role, userId, channel, target);
};

// ─── Verify OTP (login completion) ───────────────────────────────────────────

const verifyOtp = async ({ role, channel, target, otp, patientDbId }) => {
  // Second call (patient selection) — OTP already verified in first call, just confirm session is recent
  if (patientDbId) {
    await checkRecentlyVerified(role, channel, target);
  } else {
    await verifyOtpService(role, channel, target, otp);
  }

  if (role === 'patient') {
    const patients = channel === 'phone'
      ? await findPatientsByPhone(target)
      : await findPatientsByEmail(target);

    if (patients.length === 0) {
      const err = new Error('Account not found.'); err.statusCode = 404; throw err;
    }

    if (patients.length > 1 && !patientDbId) {
      // Return list — frontend must call again with selected patientDbId
      return {
        requiresSelection: true,
        patients: patients.map((p) => ({
          id: p.id,
          name: p.patient_name,
          patientId: p.patient_id,
        })),
      };
    }

    const patient = patientDbId
      ? patients.find((p) => p.id === patientDbId)
      : patients[0];

    if (!patient) {
      const err = new Error('Selected patient not found.'); err.statusCode = 404; throw err;
    }

    db.query('UPDATE patients SET app_last_login = NOW() WHERE id = ?', [patient.id]).catch(() => {});
    const payload = { id: patient.id, patientId: patient.patient_id, role: 'patient' };
    return { token: generateToken(payload), user: formatPatient(patient) };
  }

  if (role === 'doctor') {
    const doctor = channel === 'phone'
      ? await findDoctorByPhone(target)
      : await findDoctorByEmail(target);

    if (!doctor) {
      const err = new Error('Account not found.'); err.statusCode = 404; throw err;
    }

    db.query('UPDATE users SET app_last_login = NOW() WHERE id = ?', [doctor.id]).catch(() => {});
    const payload = { id: doctor.id, role: 'doctor' };
    return { token: generateToken(payload), user: formatDoctor(doctor) };
  }
};

// ─── Forgot Password — Step 1: Request OTP ───────────────────────────────────

const passwordResetRequest = async (identifier, role) => {
  const isEmail = identifier.includes('@');
  const channel = isEmail ? 'email' : 'phone';

  let userType = role || 'patient';
  let userId   = 0;

  if (role === 'doctor') {
    // Search only doctor
    const doctor = isEmail ? await findDoctorByEmail(identifier) : await findDoctorByPhone(identifier);
    if (doctor) userId = doctor.id;
  } else if (role === 'patient') {
    const patients = isEmail ? await findPatientsByEmail(identifier) : await findPatientsByPhone(identifier);
    if (patients.length > 0) userId = patients[0].id;
  } else {
    if (isEmail) {
      const patients = await findPatientsByEmail(identifier);
      if (patients.length > 0) { userId = patients[0].id; }
      else {
        const doctor = await findDoctorByEmail(identifier);
        if (doctor) { userType = 'doctor'; userId = doctor.id; }
      }
    } else {
      const patients = await findPatientsByPhone(identifier);
      if (patients.length > 0) { userId = patients[0].id; }
      else {
        const doctor = await findDoctorByPhone(identifier);
        if (doctor) { userType = 'doctor'; userId = doctor.id; }
      }
    }
  }

  if (!userId) {
    const err = new Error('No account found with this mobile number or email.'); err.statusCode = 404; throw err;
  }

  await sendOtpService(userType, userId, channel, identifier);
};

// ─── Forgot Password — Step 2: Verify OTP → return reset token ───────────────

const passwordVerifyOtp = async (identifier, otp, role) => {
  const isEmail = identifier.includes('@');
  const channel = isEmail ? 'email' : 'phone';

  let userType = role || 'patient';
  let userId   = 0;

  if (role === 'doctor') {
    const doctor = isEmail ? await findDoctorByEmail(identifier) : await findDoctorByPhone(identifier);
    if (doctor) userId = doctor.id;
  } else if (role === 'patient') {
    const patients = isEmail ? await findPatientsByEmail(identifier) : await findPatientsByPhone(identifier);
    if (patients.length > 0) userId = patients[0].id;
  } else {
    if (isEmail) {
      const patients = await findPatientsByEmail(identifier);
      if (patients.length > 0) { userId = patients[0].id; }
      else {
        const doctor = await findDoctorByEmail(identifier);
        if (doctor) { userType = 'doctor'; userId = doctor.id; }
      }
    } else {
      const patients = await findPatientsByPhone(identifier);
      if (patients.length > 0) { userId = patients[0].id; }
      else {
        const doctor = await findDoctorByPhone(identifier);
        if (doctor) { userType = 'doctor'; userId = doctor.id; }
      }
    }
  }

  if (!userId) {
    const err = new Error('No account found with this identifier.'); err.statusCode = 404; throw err;
  }

  // Verify OTP — query by channel+target only (no user_type dependency)
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;
  const [[otpRecord]] = await db.query(
    `SELECT *, TIMESTAMPDIFF(SECOND, NOW(), expires_at) AS seconds_remaining
     FROM app_otps
     WHERE channel = ? AND target = ? AND verified_at IS NULL
     ORDER BY sent_at DESC LIMIT 1`,
    [channel, identifier]
  );

  if (!otpRecord) {
    const err = new Error('OTP not found. Please request a new one.'); err.statusCode = 400; throw err;
  }
  if (otpRecord.seconds_remaining <= 0) {
    const err = new Error('OTP has expired. Please request a new one.'); err.statusCode = 400; throw err;
  }
  if (otpRecord.attempts >= maxAttempts) {
    const err = new Error('Maximum OTP attempts exceeded. Please request a new one.'); err.statusCode = 400; throw err;
  }
  if (otpRecord.otp !== otp) {
    await db.query('UPDATE app_otps SET attempts = attempts + 1 WHERE id = ?', [otpRecord.id]);
    const remaining = maxAttempts - (otpRecord.attempts + 1);
    const err = new Error(`Invalid OTP. ${remaining} attempt(s) remaining.`); err.statusCode = 400; throw err;
  }
  await db.query('UPDATE app_otps SET verified_at = NOW() WHERE id = ?', [otpRecord.id]);

  // Generate single-use reset token
  const crypto = require('crypto');
  const token = `prt_${userId}_${crypto.randomBytes(16).toString('hex')}`;
  const expiryMinutes = 15;

  await db.query(
    `INSERT INTO app_password_reset_tokens (user_type, user_id, token, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ${expiryMinutes} MINUTE))`,
    [userType, userId, token]
  );

  return { resetToken: token };
};

// ─── Forgot Password — Step 3: Reset Password ────────────────────────────────

const passwordReset = async (resetToken, newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    const err = new Error('Password must be at least 8 characters.'); err.statusCode = 400; throw err;
  }

  const [[record]] = await db.query(
    `SELECT * FROM app_password_reset_tokens
     WHERE token = ? AND used = 0 AND expires_at > NOW()`,
    [resetToken]
  );

  if (!record) {
    const err = new Error('Reset token is invalid or expired.'); err.statusCode = 400; throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  if (record.user_type === 'patient') {
    await db.query('UPDATE patients SET app_password = ? WHERE id = ?', [passwordHash, record.user_id]);
  } else {
    // Save hashed password for app login and plain password for hospital software
    await db.query(
      'UPDATE users SET app_password = ?, password = ? WHERE id = ?',
      [passwordHash, newPassword, record.user_id]
    );
  }

  // Mark token as used (single-use)
  await db.query('UPDATE app_password_reset_tokens SET used = 1 WHERE id = ?', [record.id]);
};

// ─── Login with Password ──────────────────────────────────────────────────────

const loginWithPassword = async (identifier, password, role) => {
  const isEmail = identifier.includes('@');

  let user = null;
  let userType = role;

  if (role === 'patient') {
    const patients = isEmail
      ? await findPatientsByEmail(identifier)
      : await findPatientsByPhone(identifier);
    // Pick the patient that has app_password set (registered via app)
    user = patients.find(p => p.app_password) || patients[0] || null;
  } else if (role === 'doctor') {
    user = isEmail
      ? await findDoctorByEmail(identifier)
      : await findDoctorByPhone(identifier);
  } else {
    const err = new Error('role is required. Use patient or doctor.'); err.statusCode = 400; throw err;
  }

  if (!user) {
    const err = new Error('No account found with this phone number or email.'); err.statusCode = 404; throw err;
  }

  if (!user.app_password) {
    const err = new Error('No password set for this account. Please login with OTP or reset your password.'); err.statusCode = 400; throw err;
  }

  const isMatch = await bcrypt.compare(password, user.app_password);
  if (!isMatch) {
    const err = new Error('Incorrect password.'); err.statusCode = 401; throw err;
  }

  if (role === 'patient') {
    db.query('UPDATE patients SET app_last_login = NOW() WHERE id = ?', [user.id]).catch(() => {});
    const payload = { id: user.id, patientId: user.patient_id, role: 'patient' };
    return {
      token: generateToken(payload),
      user: {
        id:        user.id,
        patientId: user.patient_id,
        name:      user.patient_name,
        phone:     user.phone || null,
        email:     user.email || null,
        role:      'patient',
      },
    };
  } else {
    db.query('UPDATE users SET app_last_login = NOW() WHERE id = ?', [user.id]).catch(() => {});
    const payload = { id: user.id, role: 'doctor' };
    return {
      token: generateToken(payload),
      user: {
        id:    user.id,
        name:  user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        phone: user.phone || null,
        email: user.email || null,
        role:  'doctor',
      },
    };
  }
};

module.exports = { register, sendOtp, verifyOtp, passwordResetRequest, passwordVerifyOtp, passwordReset, loginWithPassword };
