-- Home / marketing banners (run manually or rely on Sequelize sync alter).
CREATE TABLE IF NOT EXISTS advertisement_banners (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(300) NULL,
  image_url TEXT NULL,
  cta_text VARCHAR(80) NOT NULL DEFAULT 'Book Now',
  redirect_type VARCHAR(32) NOT NULL DEFAULT 'none',
  redirect_value VARCHAR(512) NULL,
  city VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  priority INT NOT NULL DEFAULT 0,
  start_date DATETIME NULL,
  end_date DATETIME NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_banners_active_priority (is_active, priority),
  INDEX idx_banners_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
