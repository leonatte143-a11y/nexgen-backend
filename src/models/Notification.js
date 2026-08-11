import { DataTypes, Model } from 'sequelize';

export function defineNotification(sequelize) {
  class Notification extends Model {}
  Notification.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      userId: { type: DataTypes.STRING(64), allowNull: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: true },
      type: { type: DataTypes.STRING(16), allowNull: false },
      title: DataTypes.STRING(256),
      body: DataTypes.TEXT,
      read: { type: DataTypes.BOOLEAN, defaultValue: false },
      timeLabel: DataTypes.STRING(64),
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      audience: { type: DataTypes.STRING(32), allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: true },
    },
    { sequelize, modelName: 'Notification', tableName: 'notifications', timestamps: true },
  );
  return Notification;
}
