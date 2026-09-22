CREATE TABLE IF NOT EXISTS app_otps (
  id          INT(11)                    NOT NULL AUTO_INCREMENT,
  user_type   ENUM('patient', 'doctor')  NOT NULL,
  user_id     BIGINT(20)                 NOT NULL COMMENT 'patients.id or users.id',
  channel     ENUM('phone', 'email')     NOT NULL,
  target      VARCHAR(100)               NOT NULL COMMENT 'phone number or email',
  otp         VARCHAR(10)                NOT NULL,
  attempts    INT(11)                    NOT NULL DEFAULT 0,
  expires_at  DATETIME                   NOT NULL,
  sent_at     DATETIME                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME                   NULL,
  PRIMARY KEY (id),
  INDEX idx_target (target),
  INDEX idx_user (user_type, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OTP tracking for patient and doctor login';
