import { DataTypes, Model } from 'sequelize';

export function defineGeoZone(sequelize) {
  class GeoZone extends Model {}
  GeoZone.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      name: { type: DataTypes.STRING(128), allowNull: false },
      city: { type: DataTypes.STRING(128), allowNull: false },
      polygon: DataTypes.JSON,
      surgeFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: 'GeoZone', tableName: 'geo_zones', timestamps: true },
  );
  return GeoZone;
}
