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
  // Category pricing controls
  "ALTER TABLE categories ADD COLUMN icon_url VARCHAR(512) NULL",
  "ALTER TABLE categories ADD COLUMN min_price DECIMAL(10,2) NULL",
  "ALTER TABLE categories ADD COLUMN max_price DECIMAL(10,2) NULL",
  "ALTER TABLE categories ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
  // Admin staff accounts
  "ALTER TABLE admin_users ADD COLUMN phone VARCHAR(16) NULL",
  "ALTER TABLE admin_users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
  "ALTER TABLE admin_users ADD COLUMN must_reset_password TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE admin_users ADD COLUMN last_login_at DATETIME NULL",
  "ALTER TABLE bookings ADD COLUMN end_otp VARCHAR(8) NULL",
  "ALTER TABLE bookings ADD COLUMN custom_requirements TEXT NULL",
  "ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'pending'",
  "ALTER TABLE bookings ADD COLUMN work_done_requested TINYINT(1) NOT NULL DEFAULT 0",
  "ALTER TABLE search_logs ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'search'",
  "ALTER TABLE search_logs ADD COLUMN detail_text TEXT NULL",
  "ALTER TABLE advertisement_banners ADD COLUMN media_type VARCHAR(16) NOT NULL DEFAULT 'image'",
  "ALTER TABLE advertisement_banners ADD COLUMN placement VARCHAR(32) NOT NULL DEFAULT 'home_dashboard'",
  "ALTER TABLE advertisement_banners ADD COLUMN display_order INT NOT NULL DEFAULT 0",
  "ALTER TABLE services ADD COLUMN premium_price DECIMAL(10,2) NULL",
  "ALTER TABLE admin_users ADD COLUMN permissions JSON NULL",
  "ALTER TABLE notifications ADD COLUMN expires_at DATETIME NULL",
  "ALTER TABLE notifications ADD COLUMN audience VARCHAR(32) NULL",
  "ALTER TABLE notification_campaigns ADD COLUMN audience VARCHAR(32) NOT NULL DEFAULT 'all_users'",
  "ALTER TABLE notification_campaigns ADD COLUMN expires_at DATETIME NULL",
  "ALTER TABLE advertisement_banners ADD COLUMN geo_fence JSON NULL",
  "ALTER TABLE support_conversations ADD COLUMN claimed_by_admin_id VARCHAR(64) NULL",
  "ALTER TABLE support_conversations ADD COLUMN claimed_at DATETIME NULL",
  "ALTER TABLE partners ADD COLUMN referral_code VARCHAR(32) NULL",
  "ALTER TABLE partners ADD COLUMN referred_by_partner_id VARCHAR(64) NULL",
  "ALTER TABLE partners ADD COLUMN referral_credited TINYINT(1) NOT NULL DEFAULT 0",
];

/** Column type widenings — idempotent (MODIFY COLUMN never errors on rerun). */
const COLUMN_MODIFICATIONS = ["ALTER TABLE shops MODIFY COLUMN photo_url TEXT NULL"];

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS emergency_requests (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    user_phone VARCHAR(16) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    dispatch_phone VARCHAR(16) NULL,
    notes TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS shop_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS trending_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    search_count INT NOT NULL DEFAULT 0,
    is_trending TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS shops (
    id VARCHAR(64) PRIMARY KEY,
    shop_name VARCHAR(256) NOT NULL,
    owner_name VARCHAR(256) NULL,
    category_id VARCHAR(64) NOT NULL,
    phone VARCHAR(16) NULL,
    address TEXT NULL,
    city VARCHAR(64) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    gst_or_license VARCHAR(128) NULL,
    lead_preference VARCHAR(32) DEFAULT 'offline',
    photo_url VARCHAR(512) NULL,
    rating DECIMAL(3,2) DEFAULT 4.50,
    verification_status VARCHAR(32) DEFAULT 'pending',
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    call_count INT NOT NULL DEFAULT 0,
    directions_count INT NOT NULL DEFAULT 0,
    referral_count INT NOT NULL DEFAULT 0,
    click_count INT NOT NULL DEFAULT 0,
    search_keywords TEXT NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS archived_partners (
    id VARCHAR(64) PRIMARY KEY,
    partner_id VARCHAR(64) NOT NULL,
    snapshot JSON NOT NULL,
    archived_by VARCHAR(64) NULL,
    archived_at DATETIME NOT NULL,
    created_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_campaigns (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'offer',
    city VARCHAR(120) NULL,
    total_sent INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_by VARCHAR(64) NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS partner_referral_earnings (
    id VARCHAR(64) PRIMARY KEY,
    referrer_partner_id VARCHAR(64) NOT NULL,
    referee_partner_id VARCHAR(64) NOT NULL,
    booking_id VARCHAR(64) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS marketplace_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS marketplace_listings (
    id VARCHAR(64) PRIMARY KEY,
    seller_role VARCHAR(16) NOT NULL,
    seller_id VARCHAR(64) NOT NULL,
    listing_type VARCHAR(16) NOT NULL DEFAULT 'sell',
    category_id VARCHAR(64) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    photos JSON NULL,
    price DECIMAL(12,2) NULL,
    deposit_amount DECIMAL(12,2) NULL,
    rent_price_per_day DECIMAL(12,2) NULL,
    city VARCHAR(64) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    contact_phone VARCHAR(16) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS marketplace_reports (
    id VARCHAR(64) PRIMARY KEY,
    listing_id VARCHAR(64) NOT NULL,
    reporter_role VARCHAR(16) NOT NULL,
    reporter_id VARCHAR(64) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS marketplace_conversations (
    id VARCHAR(64) PRIMARY KEY,
    listing_id VARCHAR(64) NOT NULL,
    buyer_role VARCHAR(16) NOT NULL,
    buyer_id VARCHAR(64) NOT NULL,
    seller_role VARCHAR(16) NOT NULL,
    seller_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    contact_shared TINYINT(1) NOT NULL DEFAULT 0,
    last_message TEXT NULL,
    last_message_at DATETIME NULL,
    created_at DATETIME NULL,
    updated_at DATETIME NULL
  )`,
  `CREATE TABLE IF NOT EXISTS marketplace_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL,
    sender_role VARCHAR(16) NOT NULL,
    sender_id VARCHAR(64) NULL,
    message TEXT NOT NULL,
    created_at DATETIME NULL
  )`,
];

const MARKETPLACE_SEED_CATEGORIES = [
  { id: 'construction_materials', name: 'Construction Materials' },
  { id: 'heavy_tools', name: 'Heavy Tools' },
  { id: 'furniture', name: 'Furniture' },
  { id: 'vehicles', name: 'Vehicles' },
  { id: 'electronics', name: 'Electronics' },
];

async function seedMarketplaceCategories(sequelize) {
  for (const cat of MARKETPLACE_SEED_CATEGORIES) {
    try {
      await sequelize.query(
        'INSERT IGNORE INTO marketplace_categories (id, name, is_active, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
        { replacements: [cat.id, cat.name] },
      );
    } catch {
      /* table not ready yet or already seeded — safe to ignore */
    }
  }
}

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
  for (const sql of COLUMN_MODIFICATIONS) {
    try {
      await sequelize.query(sql);
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  for (const sql of CREATE_TABLES) {
    try {
      await sequelize.query(sql);
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  await seedMarketplaceCategories(sequelize);
  return { added, skipped };
}
