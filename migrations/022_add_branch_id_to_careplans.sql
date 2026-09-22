ALTER TABLE app_patient_careplans
  ADD COLUMN branch_id INT(11) NULL DEFAULT NULL COMMENT 'Branch where patient was enrolled';
