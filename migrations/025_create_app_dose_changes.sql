CREATE TABLE IF NOT EXISTS app_dose_changes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id    INT NOT NULL,
  doctor_id     INT NOT NULL,
  medicine_id   INT NOT NULL,
  medicine_type ENUM('allopathy','madhavbaug') NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  morning       DECIMAL(5,2) NOT NULL DEFAULT 0,
  afternoon     DECIMAL(5,2) NOT NULL DEFAULT 0,
  night         DECIMAL(5,2) NOT NULL DEFAULT 0,
  sos           DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patient (patient_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
