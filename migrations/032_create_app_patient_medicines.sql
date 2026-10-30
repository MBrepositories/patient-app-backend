CREATE TABLE IF NOT EXISTS app_patient_medicines (
  id             INT(11)      NOT NULL AUTO_INCREMENT,
  patient_id     BIGINT(20)   NOT NULL COMMENT 'patients.id',
  doctor_id      INT(11)      NULL     COMMENT 'users.id — doctor who prescribed',
  medicine_name  VARCHAR(255) NOT NULL,
  form_label     VARCHAR(50)  NOT NULL DEFAULT 'TABLET' COMMENT 'TABLET, CAPSULE, SYRUP, etc.',
  morning        DECIMAL(4,2) NOT NULL DEFAULT 0,
  afternoon      DECIMAL(4,2) NOT NULL DEFAULT 0,
  night          DECIMAL(4,2) NOT NULL DEFAULT 0,
  sos            TINYINT(1)   NOT NULL DEFAULT 0,
  instructions   TEXT         NULL,
  status         ENUM('active','stopped') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient (patient_id),
  INDEX idx_patient_status (patient_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Medicines added by doctor via app';
