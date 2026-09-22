CREATE TABLE IF NOT EXISTS app_vitals (
  id          BIGINT(20)     NOT NULL AUTO_INCREMENT,
  app_user_id BIGINT(20)     NOT NULL COMMENT 'patients.id',
  type        ENUM('weight','hba1c','ldl','waist') NOT NULL,
  value       DECIMAL(7,2)   NOT NULL,
  logged_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_type_date (app_user_id, type, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Patient self-logged vitals from app';
