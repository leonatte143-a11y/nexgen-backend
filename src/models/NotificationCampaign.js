import { DataTypes, Model } from 'sequelize';

export function defineNotificationCampaign(sequelize) {
  class NotificationCampaign extends Model {}

  NotificationCampaign.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'offer' },
      city: { type: DataTypes.STRING(120), allowNull: true },
      totalSent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      deliveredCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdBy: { type: DataTypes.STRING(64), allowNull: true },
      audience: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'all_users' },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'NotificationCampaign',
      tableName: 'notification_campaigns',
      timestamps: true,
    },
  );

  return NotificationCampaign;
}
