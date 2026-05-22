import { DataTypes, Model } from 'sequelize';

export function defineSettlement(sequelize) {
  class Settlement extends Model {}
  Settlement.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      commissionAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      status: { type: DataTypes.STRING(32), defaultValue: 'pending' },
      periodStart: DataTypes.DATEONLY,
      periodEnd: DataTypes.DATEONLY,
      bankReference: DataTypes.STRING(128),
    },
    { sequelize, modelName: 'Settlement', tableName: 'settlements', timestamps: true, updatedAt: false },
  );
  return Settlement;
}
