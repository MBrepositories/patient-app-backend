CREATE TABLE IF NOT EXISTS app_survey_submissions (
  id          INT(11)                                        NOT NULL AUTO_INCREMENT,
  app_user_id BIGINT(20)                                     NOT NULL COMMENT 'patients.id',
  week_number TINYINT(3)                                     NOT NULL COMMENT 'ISO week number 1-53',
  year        SMALLINT(4)                                    NOT NULL,
  symptoms    JSON                                           NOT NULL COMMENT '[{id, value}]',
  mood_id     ENUM('very-bad','bad','okay','good','great')   NOT NULL,
  created_at  TIMESTAMP                                      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient_week (app_user_id, year, week_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Weekly patient survey submissions';
