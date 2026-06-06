import { DataTypes, Model } from 'sequelize';

export function defineCategory(sequelize) {
  class Category extends Model {}
  Category.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      nameEn: DataTypes.STRING(128),
      nameTe: DataTypes.STRING(128),
      emoji: DataTypes.STRING(8),
      iconUrl: { type: DataTypes.STRING(512), allowNull: true },
      minPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      maxPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: 'Category', tableName: 'categories', timestamps: true },
  );
  return Category;
}
