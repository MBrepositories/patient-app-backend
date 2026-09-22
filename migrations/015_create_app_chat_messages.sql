CREATE TABLE IF NOT EXISTS app_chat_messages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT NOT NULL,
  sender      ENUM('user', 'assistant') NOT NULL,
  text        TEXT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_patient_created (patient_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
