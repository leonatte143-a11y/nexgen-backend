import { Sequelize } from 'sequelize';
import { dbLog, isDevLoggingEnabled } from '../utils/devLogger.js';

const isRailwayEnvironment = Boolean(
  process.env.NEXGEN_RAILWAY === 'true' ||
  process.env.RAILWAY ||
  process.env.RAILWAY_ENV ||
  process.env.RAILWAY_GIT_BRANCH ||
  process.env.RAILWAY_PROJECT_ID ||
  process.env.RAILWAY_STATIC_URL,
);

const localDbHost = process.env.DB_HOST;
const railwayDbHost = process.env.MYSQLHOST;
const DB_HOST = (() => {
  if (isRailwayEnvironment) {
    if (railwayDbHost) return railwayDbHost;
    if (localDbHost && !['127.0.0.1', 'localhost'].includes(localDbHost.trim().toLowerCase())) return localDbHost;
    return localDbHost || '127.0.0.1';
  }
  return localDbHost || railwayDbHost || '127.0.0.1';
})();

const DB_PORT = process.env.DB_PORT || process.env.MYSQLPORT || '3306';
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || 'nexgen';
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.DB_PASS || process.env.MYSQLPASSWORD || '';

const dbPassword = DB_PASSWORD;
const hasRailwayMysqlConfig = Boolean(process.env.MYSQLHOST && process.env.MYSQLDATABASE && process.env.MYSQLUSER);

function sequelizeLogging(sql, timing) {
  dbLog(sql, timing);
}

export const databaseConfig = {
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  username: DB_USER,
  isRailway: isRailwayEnvironment,
  hasRailwayMysqlConfig: hasRailwayMysqlConfig,
};

export const sequelize = new Sequelize(DB_NAME, DB_USER, dbPassword, {
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
