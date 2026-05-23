import { Sequelize } from 'sequelize';
import { dbLog, isDevLoggingEnabled } from '../utils/devLogger.js';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_NAME = 'nexgen',
  DB_USER = 'root',
  DB_PASS = '',
  DB_PASSWORD = '',
} = process.env;

const dbPassword = DB_PASS || DB_PASSWORD;

function sequelizeLogging(sql, timing) {
  dbLog(sql, timing);
}

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
