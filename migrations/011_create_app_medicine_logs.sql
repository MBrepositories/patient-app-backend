CREATE TABLE IF NOT EXISTS app_medicine_logs (
  id             BIGINT(20)                              NOT NULL AUTO_INCREMENT,
  app_user_id    BIGINT(20)                              NOT NULL COMMENT 'patients.id',
  medicine_id    INT(11)                                 NOT NULL COMMENT 'patient_madhavbaug.id or patient_allopathy.id',
  medicine_type  ENUM('madhavbaug','allopathy')          NOT NULL,
  slot           ENUM('morning','afternoon','night','sos') NOT NULL,
  taken          TINYINT(1)                              NOT NULL DEFAULT 1,
  logged_at      TIMESTAMP                               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_date (app_user_id, logged_at),
  INDEX idx_medicine_slot (medicine_id, medicine_type, slot, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Patient medicine dose tracking from app';
