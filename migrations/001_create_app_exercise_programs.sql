CREATE TABLE IF NOT EXISTS app_exercise_programs (
  id                  INT(11)                                              NOT NULL AUTO_INCREMENT,
  plan_id             INT(11)                                              NOT NULL,
  plan_key            VARCHAR(50)                                          NOT NULL,
  plan_name           VARCHAR(100)                                         NOT NULL,
  plan_category       ENUM('exercise', 'meditation')                       NOT NULL DEFAULT 'exercise',
  day_number          INT(11)                                              NOT NULL,
  exercise_title      VARCHAR(200)                                         NOT NULL,
  video_url           TEXT                                                 NULL,
  thumbnail_url       TEXT                                                 NULL,
  requires_camera     TINYINT(1)                                           NOT NULL DEFAULT 0,
  exercise_key        ENUM('squat', 'chairExercise', 'standingSideStretch') NULL,
  target_reps         INT(11)                                              NULL,
  target_sets         INT(11)                                              NULL,
  target_hold_seconds INT(11)                                              NULL,
  notes               TEXT                                                 NULL,
  PRIMARY KEY (id),
  INDEX idx_plan_day (plan_id, day_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Exercise and meditation content per plan per day';
