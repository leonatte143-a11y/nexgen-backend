/**
 * One-time / maintenance: remove duplicate UNIQUE indexes created by Sequelize alter sync.
 *
 * Usage:
 *   node src/scripts/cleanupDuplicateIndexes.js          # apply fixes
 *   node src/scripts/cleanupDuplicateIndexes.js --dry-run
 *
 * Inspect manually (MySQL):
 *   SHOW INDEX FROM users;
 *   SHOW INDEX FROM partners;
 */

import '../loadEnv.js';
import { sequelize } from '../models/index.js';
import { INDEX_DEDUPE_TARGETS, listTableIndexes, runIndexDedupePass } from '../utils/indexMaintenance.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await sequelize.authenticate();
  console.log('[KAIRO] Index cleanup', dryRun ? '(dry run)' : '(live)');

  for (const { tableName } of INDEX_DEDUPE_TARGETS) {
    try {
      const indexes = await listTableIndexes(sequelize, tableName);
      const count = new Set(indexes.map((r) => r.Key_name)).size;
      console.log(`[KAIRO] ${tableName}: ${count} index entries before cleanup`);
    } catch (e) {
      console.log(`[KAIRO] ${tableName}: skip (${e.message})`);
    }
  }

  const results = await runIndexDedupePass(sequelize, { dryRun });
  for (const r of results) {
    console.log(
      `[KAIRO] ${r.tableName}.${r.columnName}: kept=${r.kept ?? 'n/a'} dropped=[${r.dropped.join(', ')}] created=${r.created}`,
    );
  }

  console.log('[KAIRO] Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[KAIRO] Cleanup failed:', e.message || e);
  process.exit(1);
});
