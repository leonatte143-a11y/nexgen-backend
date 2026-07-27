import { DataTypes, Model } from 'sequelize';

export function defineMarketplaceMessage(sequelize) {
  class MarketplaceMessage extends Model {}
  MarketplaceMessage.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      conversationId: { type: DataTypes.STRING(64), allowNull: false },
      senderRole: { type: DataTypes.STRING(16), allowNull: false },
      senderId: { type: DataTypes.STRING(64), allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: 'MarketplaceMessage',
      tableName: 'marketplace_messages',
      timestamps: true,
      updatedAt: false,
    },
  );
  return MarketplaceMessage;
}
