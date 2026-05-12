import { DataTypes, Model } from 'sequelize';

export function definePartnerServicePricing(sequelize) {
  class PartnerServicePricing extends Model {}
  PartnerServicePricing.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      serviceName: DataTypes.STRING(256),
      category: DataTypes.STRING(128),
      baseCost: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    },
    { sequelize, modelName: 'PartnerServicePricing', tableName: 'partner_service_pricings', timestamps: true },
  );
  return PartnerServicePricing;
}
