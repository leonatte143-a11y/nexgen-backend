import { DataTypes, Model } from 'sequelize';

export function defineSupportConversation(sequelize) {
  class SupportConversation extends Model {}
  SupportConversation.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      userId: { type: DataTypes.STRING(64), allowNull: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: true },
      bookingId: { type: DataTypes.STRING(64), allowNull: true },
      ticketId: { type: DataTypes.STRING(64), allowNull: true },
      channel: { type: DataTypes.STRING(32), defaultValue: 'customer' },
      status: { type: DataTypes.STRING(32), defaultValue: 'open' },
      lastMessage: { type: DataTypes.TEXT, allowNull: true },
      lastMessageAt: { type: DataTypes.DATE, allowNull: true },
      unreadCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      /** Admin who "joined" this conversation to provide support / resolve a dispute. */
      claimedByAdminId: { type: DataTypes.STRING(64), allowNull: true },
      claimedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'SupportConversation', tableName: 'support_conversations', timestamps: true },
  );
  return SupportConversation;
}
