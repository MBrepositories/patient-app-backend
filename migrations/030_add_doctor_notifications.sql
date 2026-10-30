-- Add doctor notification support to app_notifications
-- doctor_id: set when notification is for a doctor (patient_id will be null for these)
-- patient_id_ref: the patient who triggered the doctor notification
-- photo_url: meal photo url for meal-type notifications
ALTER TABLE app_notifications
  MODIFY COLUMN patient_id BIGINT(20) NULL DEFAULT NULL,
  ADD COLUMN doctor_id     BIGINT(20) NULL DEFAULT NULL AFTER patient_id,
  ADD COLUMN patient_id_ref BIGINT(20) NULL DEFAULT NULL AFTER doctor_id,
  ADD COLUMN photo_url     VARCHAR(500) NULL DEFAULT NULL AFTER message,
  ADD INDEX idx_doctor (doctor_id),
  ADD INDEX idx_doctor_read (doctor_id, is_read);
