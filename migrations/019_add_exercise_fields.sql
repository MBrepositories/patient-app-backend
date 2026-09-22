-- Add calories, difficulty and equipment fields to app_exercise_programs

ALTER TABLE app_exercise_programs
  ADD COLUMN calories        INT(11)      NULL DEFAULT NULL,
  ADD COLUMN difficulty_label VARCHAR(100) NULL DEFAULT NULL,
  ADD COLUMN equipment       JSON         NULL DEFAULT NULL;
