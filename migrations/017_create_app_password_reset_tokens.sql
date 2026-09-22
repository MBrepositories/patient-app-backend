CREATE TABLE IF NOT EXISTS app_password_reset_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_type   ENUM('patient', 'doctor') NOT NULL,
  user_id     INT NOT NULL,
  token       VARCHAR(100) NOT NULL UNIQUE,
  used        TINYINT(1) NOT NULL DEFAULT 0,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_token (token),
  INDEX idx_user (user_type, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
