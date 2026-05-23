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

const railwayDbHost = process.env.MYSQLHOST;
const railwayDbPort = process.env.MYSQLPORT;
const railwayDbName = process.env.MYSQLDATABASE;
const railwayDbUser = process.env.MYSQLUSER;
const railwayDbPassword = process.env.MYSQLPASSWORD;

if (isRailwayEnvironment) {
  const missingRailwayVars = [];
  if (!railwayDbHost) missingRailwayVars.push('MYSQLHOST');
  if (!railwayDbPort) missingRailwayVars.push('MYSQLPORT');
  if (!railwayDbName) missingRailwayVars.push('MYSQLDATABASE');
  if (!railwayDbUser) missingRailwayVars.push('MYSQLUSER');
  if (!railwayDbPassword) missingRailwayVars.push('MYSQLPASSWORD');

  if (missingRailwayVars.length > 0) {
    throw new Error(
      `Railway MySQL variables are missing. Add Railway MySQL plugin or configure ${missingRailwayVars.join(', ')}.`,
    );
  }
}

const DB_HOST = isRailwayEnvironment
  ? railwayDbHost
  : process.env.DB_HOST || railwayDbHost || '127.0.0.1';

const DB_PORT = isRailwayEnvironment
  ? railwayDbPort
  : process.env.DB_PORT || railwayDbPort || '3306';

const DB_NAME = isRailwayEnvironment
  ? railwayDbName
  : process.env.DB_NAME || railwayDbName || 'nexgen';

const DB_USER = isRailwayEnvironment
  ? railwayDbUser
  : process.env.DB_USER || railwayDbUser || 'root';

const DB_PASSWORD = isRailwayEnvironment
  ? railwayDbPassword
  : process.env.DB_PASSWORD || process.env.DB_PASS || railwayDbPassword || '';

const dbPassword = DB_PASSWORD;
const hasRailwayMysqlConfig = Boolean(railwayDbHost && railwayDbName && railwayDbUser);

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
  mysqlHostExists: Boolean(railwayDbHost),
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
