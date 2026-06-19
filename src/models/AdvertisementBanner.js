import { DataTypes, Model } from 'sequelize';

export function defineAdvertisementBanner(sequelize) {
  class AdvertisementBanner extends Model {}

  AdvertisementBanner.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      subtitle: { type: DataTypes.STRING(300), allowNull: true },
      imageUrl: { type: DataTypes.TEXT, allowNull: true },
      mediaType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'image' },
      placement: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'home_dashboard' },
      ctaText: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Book Now' },
      redirectType: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'none' },
      redirectValue: { type: DataTypes.STRING(512), allowNull: true },
      city: { type: DataTypes.STRING(120), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      startDate: { type: DataTypes.DATE, allowNull: true },
      endDate: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.STRING(64), allowNull: true },
    },
    {
      sequelize,
      modelName: 'AdvertisementBanner',
      tableName: 'advertisement_banners',
      timestamps: true,
    },
  );

  return AdvertisementBanner;
}
