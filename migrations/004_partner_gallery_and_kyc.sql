-- Partner gallery photos + widened avatar column + KYC fields (safe additive migration)

ALTER TABLE partners ADD COLUMN IF NOT EXISTS photos JSON NULL;
ALTER TABLE partners MODIFY COLUMN photo_url TEXT NULL;

ALTER TABLE partners ADD COLUMN IF NOT EXISTS id_type VARCHAR(32) NULL;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS id_number VARCHAR(64) NULL;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS pincode VARCHAR(6) NULL;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS custom_category_request VARCHAR(256) NULL;
