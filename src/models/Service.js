import { DataTypes, Model } from 'sequelize';

export function defineService(sequelize) {
  class Service extends Model {}
  Service.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      categoryId: { type: DataTypes.STRING(64), allowNull: false },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      name: DataTypes.STRING(256),
      subtext: DataTypes.STRING(256),
      categoryLabel: DataTypes.STRING(128),
      basePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 4.5 },
      reviewsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      description: DataTypes.TEXT,
      distanceKm: { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
      commissionPercent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 10 },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: 'Service', tableName: 'services', timestamps: true },
  );
  return Service;
}
