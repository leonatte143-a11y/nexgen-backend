import { DataTypes, Model } from 'sequelize';

export function defineSupportMessage(sequelize) {
  class SupportMessage extends Model {}
  SupportMessage.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      conversationId: { type: DataTypes.STRING(64), allowNull: false },
      senderType: { type: DataTypes.STRING(32), allowNull: false },
      senderId: { type: DataTypes.STRING(64), allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: false },
    },
    { sequelize, modelName: 'SupportMessage', tableName: 'support_messages', timestamps: true, updatedAt: false },
  );
  return SupportMessage;
}
