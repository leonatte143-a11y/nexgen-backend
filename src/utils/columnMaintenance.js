/**
 * Idempotent ADD COLUMN pass for schema drift when sync({ alter: false }) is used.
 * Safe to run on every migrate/seed/startup — ignores "duplicate column" errors.
 */

/** @param {import('sequelize').Sequelize} sequelize */
async function addColumnIfMissing(sequelize, sql) {
  try {
    await sequelize.query(sql);
    return true;
  } catch (e) {
    const msg = String(e?.original?.sqlMessage || e?.message || '');
    if (msg.includes('Duplicate column') || msg.includes('duplicate column')) {
      return false;
    }
    if (e?.original?.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    throw e;
  }
}

const COLUMN_ALTERS = [
  // Partner compliance (RBAC / strike board)
  "ALTER TABLE partners ADD COLUMN warning_count INT NOT NULL DEFAULT 0",
  "ALTER TABLE partners ADD COLUMN shadow_banned TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE partners ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE partners ADD COLUMN is_frozen TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE partners ADD COLUMN freeze_until DATETIME NULL",
  "ALTER TABLE partners ADD COLUMN archived_at DATETIME NULL",
  "ALTER TABLE partners ADD COLUMN account_status VARCHAR(32) NOT NULL DEFAULT 'active'",
  // Service soft-archive
  "ALTER TABLE services ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
  // Admin users
  "ALTER TABLE admin_users ADD COLUMN name VARCHAR(128) NULL",
  "ALTER TABLE admin_users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'super_admin'",
  "ALTER TABLE services ADD COLUMN commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00",
  "ALTER TABLE partner_service_pricings ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
  "ALTER TABLE partner_service_pricings ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'approved'",
  "ALTER TABLE partner_service_pricings ADD COLUMN previous_base_cost DECIMAL(10,2) NULL",
  "ALTER TABLE partner_service_pricings ADD COLUMN reviewed_by VARCHAR(64) NULL",
  "ALTER TABLE partner_service_pricings ADD COLUMN reviewed_at DATETIME NULL",
  "ALTER TABLE partner_service_pricings ADD COLUMN rejection_reason TEXT NULL",
  "ALTER TABLE bookings ADD COLUMN items_subtotal DECIMAL(12,2) NULL",
  "ALTER TABLE bookings ADD COLUMN promo_discount DECIMAL(10,2) NULL DEFAULT 0",
  "ALTER TABLE partners ADD COLUMN latitude DECIMAL(10,7) NULL",
  "ALTER TABLE partners ADD COLUMN longitude DECIMAL(10,7) NULL",
  "ALTER TABLE users ADD COLUMN latitude DECIMAL(10,7) NULL",
  "ALTER TABLE users ADD COLUMN longitude DECIMAL(10,7) NULL",
];

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<{ added: number; skipped: number }>}
 */
export async function runColumnEnsurePass(sequelize) {
  let added = 0;
  let skipped = 0;
  for (const sql of COLUMN_ALTERS) {
    const ok = await addColumnIfMissing(sequelize, sql);
    if (ok) added += 1;
    else skipped += 1;
  }
  return { added, skipped };
}
