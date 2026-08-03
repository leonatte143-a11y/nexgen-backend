/**
 * Safe migration script for Railway deployment.
 *
 * Default (idempotent):
 *   - Dedupe known duplicate UNIQUE indexes (users.phone, etc.)
 *   - sync({ alter: false }) — creates missing tables only, no column alters
 *
 * Optional column alters (use sparingly):
 *   DB_SYNC_ALTER=true npm run db:migrate
 *
 * If migration failed with "Too many keys specified":
 *   npm run db:cleanup-indexes
 *   npm run db:migrate
 */

import '../loadEnv.js';
import { sequelize, syncDatabase } from '../models/index.js';
import { runIndexDedupePass } from '../utils/indexMaintenance.js';
import { runColumnEnsurePass } from '../utils/columnMaintenance.js';

const alterTables = process.env.DB_SYNC_ALTER === 'true';

async function migrate() {
  console.log('[KAIRO] Starting database migration');
  console.log('[KAIRO] NODE_ENV =', process.env.NODE_ENV || 'development');
  console.log('[KAIRO] Altering tables =', alterTables);

  try {
    await sequelize.authenticate();

    console.log('[KAIRO] Running index dedupe pass (prevents duplicate UNIQUE indexes)...');
    const dedupe = await runIndexDedupePass(sequelize);
    for (const r of dedupe) {
      if (r.dropped.length > 0 || r.created) {
        console.log(
          `[KAIRO]   ${r.tableName}: kept=${r.kept} dropped=${r.dropped.length} created=${r.created}`,
        );
      }
    }

    await syncDatabase({ alter: alterTables });

    const cols = await runColumnEnsurePass(sequelize);
    if (cols.added > 0) {
      console.log(`[KAIRO] Column ensure pass: added=${cols.added} already-present=${cols.skipped}`);
    }

    console.log('[KAIRO] ✓ Database migration complete');
    console.log('[KAIRO] All tables are ready.');
    if (!alterTables) {
      console.log('[KAIRO] Tip: new tables are created; set DB_SYNC_ALTER=true only when you need column changes.');
    }
    process.exit(0);
  } catch (error) {
    console.error('[KAIRO] ✗ Migration failed:', error.message || error);
    if (String(error.message || '').includes('Too many keys')) {
      console.error('[KAIRO] Run: npm run db:cleanup-indexes');
    }
    process.exit(1);
  }
}

migrate();
