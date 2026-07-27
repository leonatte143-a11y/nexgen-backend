import { DataTypes, Model } from 'sequelize';

export function defineMarketplaceCategory(sequelize) {
  class MarketplaceCategory extends Model {}
  MarketplaceCategory.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      name: { type: DataTypes.STRING(128), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: 'MarketplaceCategory', tableName: 'marketplace_categories', timestamps: true },
  );
  return MarketplaceCategory;
}
