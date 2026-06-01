import { DataTypes, Model } from 'sequelize';

export function defineStaffPayroll(sequelize) {
  class StaffPayroll extends Model {}
  StaffPayroll.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      staffProfileId: { type: DataTypes.STRING(64), allowNull: false },
      adminUserId: { type: DataTypes.STRING(64), allowNull: false },
      periodLabel: { type: DataTypes.STRING(32), allowNull: false },
      baseSalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      performanceBonus: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      totalPayable: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      status: { type: DataTypes.STRING(16), defaultValue: 'pending' },
      meta: { type: DataTypes.JSON, defaultValue: {} },
    },
    { sequelize, modelName: 'StaffPayroll', tableName: 'staff_payrolls', timestamps: true },
  );
  return StaffPayroll;
}
