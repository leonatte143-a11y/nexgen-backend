import { DataTypes, Model } from 'sequelize';

export function defineStaffProfile(sequelize) {
  class StaffProfile extends Model {}
  StaffProfile.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      adminUserId: { type: DataTypes.STRING(64), allowNull: false },
      designation: { type: DataTypes.STRING(64), defaultValue: 'Staff' },
      baseSalary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      upiId: { type: DataTypes.STRING(128), allowNull: true },
    },
    { sequelize, modelName: 'StaffProfile', tableName: 'staff_profiles', timestamps: true },
  );
  return StaffProfile;
}
