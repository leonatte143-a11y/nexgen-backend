-- OTP storage (hashed values only). Run after backups; or rely on `npm run db:sync` with Sequelize alter.
CREATE TABLE IF NOT EXISTS otp_verifications (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  otp VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  expires_at DATETIME NOT NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_otp_phone_created (phone, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
