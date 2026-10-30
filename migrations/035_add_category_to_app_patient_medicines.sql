ALTER TABLE app_patient_medicines
  ADD COLUMN category ENUM('madhavbaug', 'allopathy') NULL DEFAULT NULL
    COMMENT 'medicine group set by doctor — null means madhavbaug by default'
    AFTER form_label;

-- Backfill known allopathy record
UPDATE app_patient_medicines SET category = 'allopathy' WHERE id = 13;
