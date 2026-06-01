import { DataTypes, Model } from 'sequelize';

export function defineFraudFlag(sequelize) {
  class FraudFlag extends Model {}
  FraudFlag.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      entityType: { type: DataTypes.STRING(32), allowNull: false },
      entityId: { type: DataTypes.STRING(64), allowNull: false },
      rule: { type: DataTypes.STRING(64), allowNull: false },
      severity: { type: DataTypes.STRING(16), defaultValue: 'medium' },
      details: { type: DataTypes.JSON, defaultValue: {} },
      status: { type: DataTypes.STRING(16), defaultValue: 'open' },
    },
    { sequelize, modelName: 'FraudFlag', tableName: 'fraud_flags', timestamps: true },
  );
  return FraudFlag;
}
