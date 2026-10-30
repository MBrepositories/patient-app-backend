ALTER TABLE app_medicine_logs
  MODIFY COLUMN medicine_type ENUM('madhavbaug', 'allopathy', 'app') NOT NULL,
  MODIFY COLUMN medicine_id   INT(11) NOT NULL COMMENT 'patient_madhavbaug.id, patient_allopathy.id, or app_patient_medicines.id';
