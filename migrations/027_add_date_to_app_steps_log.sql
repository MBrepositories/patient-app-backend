ALTER TABLE app_steps_log
  ADD COLUMN date DATE NULL AFTER type,
  ADD UNIQUE KEY uq_user_type_date (app_user_id, type, date);
