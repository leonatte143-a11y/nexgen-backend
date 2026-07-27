import { DataTypes, Model } from 'sequelize';

/** Direct Buyer<->Seller chat for a P2P listing — separate from the NEXGEN Super-Chat
 * support system since it isn't tied to a booking or admin-monitored conversation. */
export function defineMarketplaceConversation(sequelize) {
  class MarketplaceConversation extends Model {}
  MarketplaceConversation.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      listingId: { type: DataTypes.STRING(64), allowNull: false },
      buyerRole: { type: DataTypes.STRING(16), allowNull: false },
      buyerId: { type: DataTypes.STRING(64), allowNull: false },
      sellerRole: { type: DataTypes.STRING(16), allowNull: false },
      sellerId: { type: DataTypes.STRING(64), allowNull: false },
      status: { type: DataTypes.STRING(32), defaultValue: 'open' },
      contactShared: { type: DataTypes.BOOLEAN, defaultValue: false },
      lastMessage: { type: DataTypes.TEXT, allowNull: true },
      lastMessageAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'MarketplaceConversation', tableName: 'marketplace_conversations', timestamps: true },
  );
  return MarketplaceConversation;
}
