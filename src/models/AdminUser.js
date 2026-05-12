import { DataTypes, Model } from 'sequelize';

export function defineAdminUser(sequelize) {
  class AdminUser extends Model {}
  AdminUser.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      email: { type: DataTypes.STRING(256), unique: true, allowNull: false },
      passwordHash: { type: DataTypes.STRING(256), allowNull: false },
    },
    { sequelize, modelName: 'AdminUser', tableName: 'admin_users', timestamps: true },
  );
  return AdminUser;
}
