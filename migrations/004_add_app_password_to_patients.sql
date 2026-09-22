ALTER TABLE patients
  ADD COLUMN app_password      VARCHAR(255) NULL AFTER email,
  ADD COLUMN app_registered_at TIMESTAMP    NULL AFTER app_password;
