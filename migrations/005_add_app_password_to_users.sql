ALTER TABLE users
  ADD COLUMN app_password      VARCHAR(255) NULL AFTER password,
  ADD COLUMN app_registered_at TIMESTAMP    NULL AFTER app_password;
