ALTER TABLE app_patient_careplans
  ADD COLUMN doctor_id INT(11) NULL DEFAULT NULL COMMENT 'Doctor who enrolled the patient';
