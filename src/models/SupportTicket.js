import { DataTypes, Model } from 'sequelize';

export function defineSupportTicket(sequelize) {
  class SupportTicket extends Model {}
  SupportTicket.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      bookingId: DataTypes.STRING(64),
      userId: DataTypes.STRING(64),
      partnerId: DataTypes.STRING(64),
      subject: { type: DataTypes.STRING(256), allowNull: false },
      description: DataTypes.TEXT,
      status: { type: DataTypes.STRING(32), defaultValue: 'open' },
      priority: { type: DataTypes.STRING(16), defaultValue: 'normal' },
      paymentFrozen: { type: DataTypes.BOOLEAN, defaultValue: false },
      chatTranscript: { type: DataTypes.JSON, defaultValue: [] },
    },
    { sequelize, modelName: 'SupportTicket', tableName: 'support_tickets', timestamps: true },
  );
  return SupportTicket;
}
