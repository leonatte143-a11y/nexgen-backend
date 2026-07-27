import { DataTypes, Model } from 'sequelize';

export function defineMarketplaceReport(sequelize) {
  class MarketplaceReport extends Model {}
  MarketplaceReport.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      listingId: { type: DataTypes.STRING(64), allowNull: false },
      reporterRole: { type: DataTypes.STRING(16), allowNull: false },
      reporterId: { type: DataTypes.STRING(64), allowNull: false },
      reason: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      sequelize,
      modelName: 'MarketplaceReport',
      tableName: 'marketplace_reports',
      timestamps: true,
      updatedAt: false,
    },
  );
  return MarketplaceReport;
}
