import { DataTypes, Model } from 'sequelize';

export function defineNotification(sequelize) {
  class Notification extends Model {}
  Notification.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      userId: { type: DataTypes.STRING(64), allowNull: true },
      type: { type: DataTypes.STRING(16), allowNull: false },
      title: DataTypes.STRING(256),
      body: DataTypes.TEXT,
      read: { type: DataTypes.BOOLEAN, defaultValue: false },
      timeLabel: DataTypes.STRING(64),
    },
    { sequelize, modelName: 'Notification', tableName: 'notifications', timestamps: true },
  );
  return Notification;
}
