-- Partner-submitted ad requests: adds moderation status + owning partner to advertisement_banners.
-- Existing rows (and any admin-created banners) default to status='approved' so nothing already
-- live is hidden by this change.

ALTER TABLE advertisement_banners ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'approved';
ALTER TABLE advertisement_banners ADD COLUMN IF NOT EXISTS partner_id VARCHAR(64) NULL;

CREATE INDEX IF NOT EXISTS idx_banners_status ON advertisement_banners (status);
CREATE INDEX IF NOT EXISTS idx_banners_partner ON advertisement_banners (partner_id);
