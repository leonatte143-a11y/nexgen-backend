import { DataTypes, Model } from 'sequelize';

export function defineShop(sequelize) {
  class Shop extends Model {}
  Shop.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      shopName: { type: DataTypes.STRING(256), allowNull: false },
      ownerName: { type: DataTypes.STRING(256), allowNull: true },
      categoryId: { type: DataTypes.STRING(64), allowNull: false },
      phone: { type: DataTypes.STRING(16), allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },
      city: { type: DataTypes.STRING(64), defaultValue: 'Rajahmundry' },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      gstOrLicense: { type: DataTypes.STRING(128), allowNull: true },
      leadPreference: { type: DataTypes.STRING(32), defaultValue: 'offline' },
      photoUrl: { type: DataTypes.TEXT, allowNull: true },
      rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 4.5 },
      verificationStatus: { type: DataTypes.STRING(32), defaultValue: 'pending' },
      isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: false },
      callCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      directionsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      referralCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      clickCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      searchKeywords: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'Shop', tableName: 'shops', timestamps: true },
  );
  return Shop;
}
