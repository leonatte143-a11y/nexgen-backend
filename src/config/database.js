import { Sequelize } from 'sequelize';
import { dbLog, isDevLoggingEnabled } from '../utils/devLogger.js';

const isRailwayEnvironment = Boolean(
  process.env.KAIRO_RAILWAY === 'true' ||
  process.env.RAILWAY ||
  process.env.RAILWAY_ENV ||
  process.env.RAILWAY_GIT_BRANCH ||
  process.env.RAILWAY_PROJECT_ID ||
  process.env.RAILWAY_STATIC_URL,
);

const railwayDbHost = process.env.MYSQLHOST || process.env.MYSQL_HOST;
const railwayDbPort = process.env.MYSQLPORT || process.env.MYSQL_PORT;
const railwayDbName = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE;
const railwayDbUser = process.env.MYSQLUSER || process.env.MYSQL_USER;
const railwayDbPassword = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD;
const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

const localDbHost = process.env.DB_HOST;
const localDbPort = process.env.DB_PORT;
const localDbName = process.env.DB_NAME;
const localDbUser = process.env.DB_USER;
const localDbPassword = process.env.DB_PASSWORD || process.env.DB_PASS;

const hasRailwayVars = Boolean(
  railwayDbHost ||
  railwayDbPort ||
  railwayDbName ||
  railwayDbUser ||
  railwayDbPassword,
);
const hasLocalVars = Boolean(
  localDbHost ||
  localDbPort ||
  localDbName ||
  localDbUser ||
  localDbPassword,
);

const source = databaseUrl
  ? 'DATABASE_URL'
  : hasRailwayVars
  ? 'MYSQL variables'
  : 'DB variables';

if (source === 'MYSQL variables') {
  const missingRailwayVars = [];
  if (!railwayDbHost) missingRailwayVars.push('MYSQLHOST/MYSQL_HOST');
  if (!railwayDbPort) missingRailwayVars.push('MYSQLPORT/MYSQL_PORT');
  if (!railwayDbName) missingRailwayVars.push('MYSQLDATABASE/MYSQL_DATABASE');
  if (!railwayDbUser) missingRailwayVars.push('MYSQLUSER/MYSQL_USER');
  if (!railwayDbPassword) missingRailwayVars.push('MYSQLPASSWORD/MYSQL_PASSWORD');

  if (missingRailwayVars.length > 0) {
    throw new Error(
      `MySQL variable set incomplete. Configure ${missingRailwayVars.join(', ')} or use DATABASE_URL/DB_* variables.`,
    );
  }
}

if (isRailwayEnvironment && source === 'DB variables') {
  throw new Error(
    'Railway database is not attached. Add Railway MySQL service or manually add DB variables.',
  );
}
// Parse DATABASE_URL when present so we can still show host/name in logs
let parsedUrlHost;
let parsedUrlDatabase;
if (databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    parsedUrlHost = u.hostname || undefined;
    parsedUrlDatabase = u.pathname ? u.pathname.replace(/^\//, '') : undefined;
  } catch (e) {
    parsedUrlHost = undefined;
    parsedUrlDatabase = undefined;
  }
}

const DB_HOST = source === 'DATABASE_URL'
  ? parsedUrlHost
  : source === 'MYSQL variables'
  ? railwayDbHost
  : localDbHost || railwayDbHost || '127.0.0.1';

const DB_PORT = source === 'DATABASE_URL'
  ? (parsedUrlHost ? String(new URL(databaseUrl).port || '3306') : undefined)
  : source === 'MYSQL variables'
  ? railwayDbPort
  : localDbPort || railwayDbPort || '3306';

const DB_NAME = source === 'DATABASE_URL'
  ? parsedUrlDatabase
  : source === 'MYSQL variables'
  ? railwayDbName
  : localDbName || railwayDbName || 'kairo';

const DB_USER = source === 'DATABASE_URL'
  ? (databaseUrl ? new URL(databaseUrl).username : undefined)
  : source === 'MYSQL variables'
  ? railwayDbUser
  : localDbUser || railwayDbUser || 'root';

const DB_PASSWORD = source === 'DATABASE_URL'
  ? (databaseUrl ? new URL(databaseUrl).password : undefined)
  : source === 'MYSQL variables'
  ? railwayDbPassword
  : localDbPassword || railwayDbPassword || '';

const dbPassword = DB_PASSWORD;
const hasRailwayMysqlConfig = Boolean(railwayDbHost && railwayDbName && railwayDbUser);

function sequelizeLogging(sql, timing) {
  dbLog(sql, timing);
}

export const databaseConfig = {
  host: DB_HOST,
  port: Number(DB_PORT || 0),
  database: DB_NAME,
  username: DB_USER,
  source,
  isRailway: isRailwayEnvironment,
  hasRailwayMysqlConfig,
  mysqlHostExists: Boolean(railwayDbHost),
  databaseUrlExists: Boolean(databaseUrl),
};

export const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'mysql',
      logging: isDevLoggingEnabled() ? sequelizeLogging : false,
      benchmark: isDevLoggingEnabled(),
      define: {
        underscored: true,
        freezeTableName: true,
      },
    })
  : new Sequelize(DB_NAME, DB_USER, dbPassword, {
      host: DB_HOST,
      port: Number(DB_PORT),
      dialect: 'mysql',
      logging: isDevLoggingEnabled() ? sequelizeLogging : false,
      benchmark: isDevLoggingEnabled(),
      define: {
        underscored: true,
        freezeTableName: true,
      },
    });
