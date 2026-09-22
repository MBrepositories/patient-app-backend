CREATE TABLE IF NOT EXISTS app_patient_careplans (
  id          INT(11)                                      NOT NULL AUTO_INCREMENT,
  patient_id  BIGINT(20)                                   NOT NULL COMMENT 'patients.id',
  plan_id     INT(11)                                      NOT NULL,
  start_date  DATE                                         NOT NULL,
  total_days  INT(11)                                      NOT NULL DEFAULT 90,
  status      ENUM('active', 'paused', 'completed')        NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient (patient_id),
  INDEX idx_patient_plan (patient_id, plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Patient care plan enrollments';
