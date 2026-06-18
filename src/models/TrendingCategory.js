import { DataTypes, Model } from 'sequelize';

export function defineTrendingCategory(sequelize) {
  class TrendingCategory extends Model {}
  TrendingCategory.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      name: { type: DataTypes.STRING(128), allowNull: false },
      searchCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      isTrending: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { sequelize, modelName: 'TrendingCategory', tableName: 'trending_categories', timestamps: true },
  );
  return TrendingCategory;
}
