import './loadEnv.js';
import { assertJwtSecretsConfigured, jwtSecretsReport } from './utils/jwt.js';
import app from './app.js';
import { connectDatabase, syncDatabase, sequelize } from './models/index.js';
import { runColumnEnsurePass } from './utils/columnMaintenance.js';
import { databaseConfig } from './config/database.js';

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  // Startup environment summary
  /* eslint-disable no-console */
  console.log('[NEXGEN] Starting up');
  console.log('[NEXGEN] NODE_ENV =', process.env.NODE_ENV || 'undefined');
  console.log('[NEXGEN] Running on Railway =', process.env.NEXGEN_RAILWAY === 'true');
  console.log('[NEXGEN] Database source =', databaseConfig.source);
  console.log('[NEXGEN] Database host selected =', databaseConfig.host || '(none)');
  console.log('[NEXGEN] Database name selected =', databaseConfig.database || '(none)');
  console.log('[NEXGEN] MYSQLHOST exists =', databaseConfig.mysqlHostExists);
  const jwtreport = jwtSecretsReport();
  console.log('[NEXGEN] JWT secrets present:', jwtreport);
  /* eslint-enable no-console */

  // Validate JWT secrets; this will produce friendly messages tailored to local vs hosted
  assertJwtSecretsConfigured();

  if (databaseConfig.isRailway && !databaseConfig.hasRailwayMysqlConfig) {
    console.error('[NEXGEN] Railway MySQL plugin is not configured or required MYSQL* vars are missing.');
    console.error('[NEXGEN] Add Railway MySQL plugin or set MYSQLHOST/MYSQLDATABASE/MYSQLUSER/MYSQLPASSWORD.');
    process.exit(1);
  }

  const shouldSync = process.env.DB_SYNC === 'true';
  if (shouldSync) {
    // When DB_SYNC is explicitly requested we treat failures as fatal so devs
    // can notice and fix schema problems early.
    await syncDatabase({ alter: true });
    console.log('[NEXGEN] Database sync complete');
  } else {
    try {
      await connectDatabase();
      await runColumnEnsurePass(sequelize);
      console.log('[NEXGEN] Database connected');
    } catch (e) {
      const isRailway = process.env.NEXGEN_RAILWAY === 'true';
      console.error('[NEXGEN] Database connection failed:', e.message || e);
      if (isRailway) {
        console.error('[NEXGEN] Railway production requires a working database connection.');
        process.exit(1);
      }
      console.error('[NEXGEN] Continuing startup without DB connection.');
    }
  }

  const server = app.listen(port, host, () => {
    console.log(`NEXGEN API listening on http://${host}:${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(
        `[NEXGEN] Port ${port} already in use (EADDRINUSE). Another process may be running.`,
      );
      console.error('[NEXGEN] Tips: stop the existing process, or set a different PORT environment variable.');
      process.exit(1);
    }
    console.error('[NEXGEN] HTTP server error:', err);
    process.exit(1);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
