import { DataTypes, Model } from 'sequelize';

export function defineShopCategory(sequelize) {
  class ShopCategory extends Model {}
  ShopCategory.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      name: { type: DataTypes.STRING(128), allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: 'ShopCategory', tableName: 'shop_categories', timestamps: true },
  );
  return ShopCategory;
}
