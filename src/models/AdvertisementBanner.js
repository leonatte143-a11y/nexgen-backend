import { DataTypes, Model } from 'sequelize';

export function defineAdvertisementBanner(sequelize) {
  class AdvertisementBanner extends Model {}

  AdvertisementBanner.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      subtitle: { type: DataTypes.STRING(300), allowNull: true },
      imageUrl: { type: DataTypes.TEXT('long'), allowNull: true },
      mediaType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'image' },
      placement: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'home_dashboard' },
      ctaText: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Book Now' },
      redirectType: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'none' },
      redirectValue: { type: DataTypes.STRING(512), allowNull: true },
      city: { type: DataTypes.STRING(120), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      startDate: { type: DataTypes.DATE, allowNull: true },
      endDate: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.STRING(64), allowNull: true },
      /** Optional geo-fence polygon: array of { lat, lng } points. Null/empty = no location restriction. */
      geoFence: { type: DataTypes.JSON, allowNull: true },
      /** 'pending' | 'approved' | 'rejected'. Partner/User-submitted ads are auto-approved at
       * creation so they go live instantly — 'pending'/'rejected' are now only reached if an
       * admin later manually flags/rejects a live ad for review. */
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'approved' },
      /** Optional note an admin attaches when flagging/rejecting a submitted ad — shown to the
       * submitter as the "reason" in their My Ads > Pending tab. */
      reviewNote: { type: DataTypes.STRING(500), allowNull: true },
      /** Nullable FK to partners.id — set when a banner was submitted by a partner (vs. admin-created). */
      partnerId: { type: DataTypes.STRING(64), allowNull: true },
      /** Nullable FK to users.id — set when a banner was submitted by a User via the
       * "Advertise your business" flow (vs. a Partner or admin-created banner). */
      userId: { type: DataTypes.STRING(64), allowNull: true },
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
