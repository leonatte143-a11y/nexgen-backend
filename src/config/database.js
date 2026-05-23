import { Sequelize } from 'sequelize';
import { dbLog, isDevLoggingEnabled } from '../utils/devLogger.js';

const {
  DB_HOST = process.env.MYSQLHOST || '127.0.0.1',
  DB_PORT = process.env.MYSQLPORT || '3306',
  DB_NAME = process.env.DB_NAME ?? process.env.MYSQLDATABASE ?? 'nexgen',
  DB_USER = process.env.DB_USER ?? process.env.MYSQLUSER ?? 'root',
  DB_PASS = '',
  DB_PASSWORD = process.env.DB_PASSWORD ?? process.env.MYSQLPASSWORD ?? '',
} = process.env;

const dbPassword = process.env.DB_PASS || DB_PASSWORD;
const isRailwayDatabase = Boolean(
  process.env.MYSQLHOST ||
  process.env.MYSQLPORT ||
  process.env.MYSQLDATABASE ||
  process.env.MYSQLUSER ||
  process.env.MYSQLPASSWORD ||
  process.env.RAILWAY_DATABASE_URL,
);

function sequelizeLogging(sql, timing) {
  dbLog(sql, timing);
}

export const databaseConfig = {
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  username: DB_USER,
  isRailway: isRailwayDatabase,
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
