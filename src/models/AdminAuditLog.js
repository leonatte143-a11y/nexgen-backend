import { DataTypes, Model } from 'sequelize';

export function defineAdminAuditLog(sequelize) {
  class AdminAuditLog extends Model {}
  AdminAuditLog.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      adminId: { type: DataTypes.STRING(64), allowNull: false },
      action: { type: DataTypes.STRING(128), allowNull: false },
      entityType: DataTypes.STRING(64),
      entityId: DataTypes.STRING(64),
      meta: DataTypes.JSON,
    },
    { sequelize, modelName: 'AdminAuditLog', tableName: 'admin_audit_logs', timestamps: true, updatedAt: false },
  );
  return AdminAuditLog;
}
