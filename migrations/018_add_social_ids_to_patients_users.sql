-- Add Google and Apple social ID columns to patients and users tables

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS apple_id  VARCHAR(255) NULL DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_google_id (google_id),
  ADD INDEX IF NOT EXISTS idx_apple_id  (apple_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS apple_id  VARCHAR(255) NULL DEFAULT NULL,
  ADD INDEX IF NOT EXISTS idx_google_id (google_id),
  ADD INDEX IF NOT EXISTS idx_apple_id  (apple_id);
