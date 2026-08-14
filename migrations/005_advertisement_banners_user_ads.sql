-- Fixes the "Submission failed internal error" bug on ad submission:
-- 1) image_url was TEXT (64KB max in MySQL) but base64-encoded banner images routinely exceed
--    that, causing a masked DB error. LONGTEXT removes the practical size ceiling.
-- 2) Adds user_id so Users (not just Partners) can submit "Advertise your business" requests,
--    matching the mobile app's User-App entry point for this flow.

ALTER TABLE advertisement_banners MODIFY COLUMN image_url LONGTEXT NULL;
ALTER TABLE advertisement_banners ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) NULL;

CREATE INDEX IF NOT EXISTS idx_banners_user ON advertisement_banners (user_id);
