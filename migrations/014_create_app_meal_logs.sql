CREATE TABLE IF NOT EXISTS app_meal_logs (
  id INT(11) NOT NULL AUTO_INCREMENT,
  patient_id INT(11) NOT NULL,
  meal_period ENUM('breakfast','lunch','dinner','snack') NOT NULL,
  has_photo TINYINT(1) DEFAULT 0,
  notes TEXT NULL,
  time_label VARCHAR(20) NULL,
  estimated_calories INT(11) DEFAULT 0,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient_date (patient_id, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_food_logs (
  id INT(11) NOT NULL AUTO_INCREMENT,
  patient_id INT(11) NOT NULL,
  meal_period ENUM('breakfast','lunch','dinner','snack') NOT NULL,
  food_item_id VARCHAR(100) NOT NULL,
  food_name VARCHAR(200) NOT NULL,
  quantity_label VARCHAR(100) NULL,
  calories INT(11) DEFAULT 0,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient_date (patient_id, logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
