CREATE TABLE IF NOT EXISTS app_reward_points (
  id          BIGINT(20)    NOT NULL AUTO_INCREMENT,
  app_user_id BIGINT(20)    NOT NULL COMMENT 'patients.id',
  activity    VARCHAR(50)   NOT NULL COMMENT 'log-vitals, exercise, survey, steps-goal, medicine-taken',
  points      INT(11)       NOT NULL DEFAULT 0,
  note        VARCHAR(255)  NULL,
  earned_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_user_date (app_user_id, earned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Patient reward points log';
