CREATE TABLE IF NOT EXISTS app_notifications (
  id          INT(11)       NOT NULL AUTO_INCREMENT,
  patient_id  BIGINT(20)    NOT NULL COMMENT 'patients.id',
  type        VARCHAR(20)   NOT NULL COMMENT 'appointment | medication | insight | vitals | lab',
  title       VARCHAR(255)  NOT NULL,
  message     TEXT          NOT NULL,
  is_read     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient (patient_id),
  INDEX idx_patient_read (patient_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='In-app notifications for patients';
