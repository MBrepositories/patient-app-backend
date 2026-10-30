ALTER TABLE app_vitals
  MODIFY COLUMN type ENUM('weight','hba1c','ldl','waist','height','bsl_fasting','bsl_pp','water','blood_pressure') NOT NULL,
  ADD COLUMN secondary_value DECIMAL(10,2) NULL DEFAULT NULL AFTER value;
