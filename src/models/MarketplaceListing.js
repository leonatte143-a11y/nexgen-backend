import { DataTypes, Model } from 'sequelize';

/** P2P Marketplace: rentals, OLX-style classifieds, and leftover-material resale —
 * one unified listing shape across all three "Post Ad" intents. */
export function defineMarketplaceListing(sequelize) {
  class MarketplaceListing extends Model {}
  MarketplaceListing.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      sellerRole: { type: DataTypes.STRING(16), allowNull: false }, // 'user' | 'partner'
      sellerId: { type: DataTypes.STRING(64), allowNull: false },
      listingType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'sell' }, // 'rent' | 'sell' | 'resale'
      categoryId: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      photos: { type: DataTypes.JSON, defaultValue: [] },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      depositAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      rentPricePerDay: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      city: { type: DataTypes.STRING(64), allowNull: true },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      contactPhone: { type: DataTypes.STRING(16), allowNull: true },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' }, // active|rented|sold|removed|banned
    },
    { sequelize, modelName: 'MarketplaceListing', tableName: 'marketplace_listings', timestamps: true },
  );
  return MarketplaceListing;
}
