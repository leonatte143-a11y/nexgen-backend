import { DataTypes, Model } from 'sequelize';

export const REVENUE_CATEGORIES = [
  'user_subscription',
  'partner_subscription',
  'partner_registration',
  'booking_commission',
  'advertising',
];

export function defineRevenueTransaction(sequelize) {
  class RevenueTransaction extends Model {}
  RevenueTransaction.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      sourceType: { type: DataTypes.STRING(64), allowNull: false },
      sourceId: { type: DataTypes.STRING(64), allowNull: true },
      category: {
        type: DataTypes.STRING(48),
        allowNull: false,
        validate: { isIn: [REVENUE_CATEGORIES] },
      },
      grossAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      commissionAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      netAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.STRING(32), defaultValue: 'completed' },
      city: { type: DataTypes.STRING(128), allowNull: true },
    },
    { sequelize, modelName: 'RevenueTransaction', tableName: 'revenue_transactions', timestamps: true },
  );
  return RevenueTransaction;
}
