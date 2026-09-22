CREATE TABLE IF NOT EXISTS app_steps_log (
  id          BIGINT(20)    NOT NULL AUTO_INCREMENT,
  app_user_id BIGINT(20)    NOT NULL COMMENT 'patients.id',
  type        ENUM('steps','walking') NOT NULL DEFAULT 'steps',
  steps       INT(11)       NOT NULL DEFAULT 0 COMMENT 'running total from pedometer',
  logged_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_type_date (app_user_id, type, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Pedometer step and walking sync logs';
