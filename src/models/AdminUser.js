import { DataTypes, Model } from 'sequelize';

export function defineAdminUser(sequelize) {
  class AdminUser extends Model {}
  AdminUser.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      email: { type: DataTypes.STRING(256), allowNull: false },
      passwordHash: { type: DataTypes.STRING(256), allowNull: false },
      name: DataTypes.STRING(128),
      role: { type: DataTypes.STRING(32), defaultValue: 'super_admin' },
    },
    {
      sequelize,
      modelName: 'AdminUser',
      tableName: 'admin_users',
      timestamps: true,
      indexes: [{ unique: true, fields: ['email'], name: 'admin_users_email_unique' }],
    },
  );
  return AdminUser;
}
