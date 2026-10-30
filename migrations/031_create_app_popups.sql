-- Popup definitions (created by admin in PowerMAP v3)
CREATE TABLE IF NOT EXISTS app_popups (
  id            BIGINT(20)   NOT NULL AUTO_INCREMENT,
  title         VARCHAR(255) NOT NULL,
  message       TEXT         NULL,
  image_url     VARCHAR(500) NULL DEFAULT NULL,
  type          ENUM('manual','auto') NOT NULL DEFAULT 'manual',
  action_label  VARCHAR(100) NULL DEFAULT NULL  COMMENT 'Button label, e.g. "Learn More"',
  action_url    VARCHAR(500) NULL DEFAULT NULL  COMMENT 'Deep link or URL for the action button',

  -- Targeting filters (NULL = applies to all)
  target_branch_id   INT(11) NULL DEFAULT NULL,
  target_careplan_id INT(11) NULL DEFAULT NULL  COMMENT 'Match against app_patient_careplans.careplan_id',

  -- Lifecycle
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  expires_at    DATETIME     NULL DEFAULT NULL  COMMENT 'NULL = never expires',

  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_active_expires (is_active, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-patient dismiss tracking
CREATE TABLE IF NOT EXISTS app_popup_dismissals (
  id          BIGINT(20) NOT NULL AUTO_INCREMENT,
  popup_id    BIGINT(20) NOT NULL,
  patient_id  BIGINT(20) NOT NULL,
  dismissed_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_popup_patient (popup_id, patient_id),
  INDEX idx_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
