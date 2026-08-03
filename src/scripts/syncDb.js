import '../loadEnv.js';
import { sequelize, syncDatabase } from '../models/index.js';
import { runIndexDedupePass } from '../utils/indexMaintenance.js';

const alterTables = process.env.DB_SYNC_ALTER === 'true';

runIndexDedupePass(sequelize)
  .then(() => syncDatabase({ alter: alterTables }))
  .then(() => {
    console.log('[KAIRO] Database synced (alter=' + alterTables + ')');
    process.exit(0);
  })
  .catch((e) => {
    console.error('[KAIRO] Database sync failed:', e.message || e);
    process.exit(1);
  });
