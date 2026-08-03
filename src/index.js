import './loadEnv.js';
import { assertJwtSecretsConfigured, jwtSecretsReport } from './utils/jwt.js';
import app from './app.js';
import { connectDatabase, syncDatabase, sequelize } from './models/index.js';
import { runColumnEnsurePass } from './utils/columnMaintenance.js';
import { databaseConfig } from './config/database.js';
import { initChatSocket } from './realtime/chatSocket.js';

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  // Startup environment summary
  /* eslint-disable no-console */
  console.log('[KAIRO] Starting up');
  console.log('[KAIRO] NODE_ENV =', process.env.NODE_ENV || 'undefined');
  console.log('[KAIRO] Running on Railway =', process.env.KAIRO_RAILWAY === 'true');
  console.log('[KAIRO] Database source =', databaseConfig.source);
  console.log('[KAIRO] Database host selected =', databaseConfig.host || '(none)');
  console.log('[KAIRO] Database name selected =', databaseConfig.database || '(none)');
  console.log('[KAIRO] MYSQLHOST exists =', databaseConfig.mysqlHostExists);
  const jwtreport = jwtSecretsReport();
  console.log('[KAIRO] JWT secrets present:', jwtreport);
  /* eslint-enable no-console */

  // Validate JWT secrets; this will produce friendly messages tailored to local vs hosted
  assertJwtSecretsConfigured();

  if (databaseConfig.isRailway && !databaseConfig.hasRailwayMysqlConfig) {
    console.error('[KAIRO] Railway MySQL plugin is not configured or required MYSQL* vars are missing.');
    console.error('[KAIRO] Add Railway MySQL plugin or set MYSQLHOST/MYSQLDATABASE/MYSQLUSER/MYSQLPASSWORD.');
    process.exit(1);
  }

  const shouldSync = process.env.DB_SYNC === 'true';
  if (shouldSync) {
    // When DB_SYNC is explicitly requested we treat failures as fatal so devs
    // can notice and fix schema problems early.
    await syncDatabase({ alter: true });
    console.log('[KAIRO] Database sync complete');
  } else {
    try {
      await connectDatabase();
      await runColumnEnsurePass(sequelize);
      console.log('[KAIRO] Database connected');
    } catch (e) {
      const isRailway = process.env.KAIRO_RAILWAY === 'true';
      console.error('[KAIRO] Database connection failed:', e.message || e);
      if (isRailway) {
        console.error('[KAIRO] Railway production requires a working database connection.');
        process.exit(1);
      }
      console.error('[KAIRO] Continuing startup without DB connection.');
    }
  }

  const server = app.listen(port, host, () => {
    console.log(`KAIRO API listening on http://${host}:${port}`);
  });

  initChatSocket(server);
  console.log('[KAIRO] Super-Chat Socket.IO attached');

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(
        `[KAIRO] Port ${port} already in use (EADDRINUSE). Another process may be running.`,
      );
      console.error('[KAIRO] Tips: stop the existing process, or set a different PORT environment variable.');
      process.exit(1);
    }
    console.error('[KAIRO] HTTP server error:', err);
    process.exit(1);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
