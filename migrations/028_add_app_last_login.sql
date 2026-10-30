-- Add app_last_login to patients (tracks any login via the mobile app)
ALTER TABLE patients
  ADD COLUMN app_last_login DATETIME NULL DEFAULT NULL AFTER app_registered_at;

-- Add app_last_login to users/doctors
ALTER TABLE users
  ADD COLUMN app_last_login DATETIME NULL DEFAULT NULL AFTER app_registered_at;
