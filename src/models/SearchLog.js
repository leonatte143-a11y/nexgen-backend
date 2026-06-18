import { DataTypes, Model } from 'sequelize';

export function defineSearchLog(sequelize) {
  class SearchLog extends Model {}
  SearchLog.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      query: { type: DataTypes.STRING(256), allowNull: false },
      city: DataTypes.STRING(128),
      resultsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      lat: DataTypes.DECIMAL(10, 7),
      lng: DataTypes.DECIMAL(10, 7),
      userId: DataTypes.STRING(64),
      source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'search' },
      detailText: DataTypes.TEXT,
    },
    { sequelize, modelName: 'SearchLog', tableName: 'search_logs', timestamps: true, updatedAt: false },
  );
  return SearchLog;
}
