ALTER TABLE app_patient_medicines
  ADD COLUMN course_days  INT(11)  NULL AFTER instructions,
  ADD COLUMN start_date   DATE     NULL AFTER course_days;
