ALTER TABLE app_patient_careplans
  ADD COLUMN step_goal      INT(11) NULL DEFAULT NULL COMMENT 'Doctor override for daily step goal. NULL = use careplan default.',
  ADD COLUMN walking_target INT(11) NULL DEFAULT NULL COMMENT 'Doctor override for daily walking target. NULL = use careplan default.';
