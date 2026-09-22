CREATE TABLE IF NOT EXISTS app_meal_photos (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id   INT NOT NULL,
  meal_period  ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
  photo_url    VARCHAR(500) NOT NULL,
  uploaded_at  DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_patient_date (patient_id, uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
