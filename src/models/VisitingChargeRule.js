import { DataTypes, Model } from 'sequelize';

export function defineVisitingChargeRule(sequelize) {
  class VisitingChargeRule extends Model {}
  VisitingChargeRule.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      minKm: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
      maxKm: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      charge: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      city: { type: DataTypes.STRING(128), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: 'VisitingChargeRule', tableName: 'visiting_charge_rules', timestamps: true },
  );
  return VisitingChargeRule;
}
