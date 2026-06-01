import { DataTypes, Model } from 'sequelize';

export function definePartnerWarning(sequelize) {
  class PartnerWarning extends Model {}
  PartnerWarning.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      adminId: { type: DataTypes.STRING(64), allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      severity: { type: DataTypes.STRING(16), defaultValue: 'warning' },
    },
    { sequelize, modelName: 'PartnerWarning', tableName: 'partner_warnings', timestamps: true },
  );
  return PartnerWarning;
}
