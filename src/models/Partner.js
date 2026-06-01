import { DataTypes, Model } from 'sequelize';

export function definePartner(sequelize) {
  class Partner extends Model {}
  Partner.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      phone: { type: DataTypes.STRING(16), allowNull: false },
      name: DataTypes.STRING(256),
      photoUrl: DataTypes.STRING(512),
      rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 4.8 },
      jobsCompleted: { type: DataTypes.INTEGER, defaultValue: 0 },
      isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
      skills: { type: DataTypes.JSON, defaultValue: [] },
      categories: { type: DataTypes.JSON, defaultValue: [] },
      walletBalance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      todayEarnings: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      lifetimeEarnings: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      bankName: DataTypes.STRING(256),
      bankAccount: DataTypes.STRING(64),
      verificationStatus: { type: DataTypes.STRING(32), defaultValue: 'Pending' },
      trainingProgress: { type: DataTypes.INTEGER, defaultValue: 0 },
      badges: { type: DataTypes.JSON, defaultValue: [] },
      strikeCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      warningCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      shadowBanned: { type: DataTypes.BOOLEAN, defaultValue: false },
      isBlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
      isFrozen: { type: DataTypes.BOOLEAN, defaultValue: false },
      freezeUntil: { type: DataTypes.DATE, allowNull: true },
      archivedAt: { type: DataTypes.DATE, allowNull: true },
      accountStatus: { type: DataTypes.STRING(32), defaultValue: 'active' },
      primaryCity: { type: DataTypes.STRING(128), defaultValue: 'Rajahmundry' },
      serviceInnerRadiusKm: { type: DataTypes.INTEGER, defaultValue: 5 },
      serviceOuterRadiusKm: { type: DataTypes.INTEGER, defaultValue: 10 },
      allowOutOfStation: { type: DataTypes.BOOLEAN, defaultValue: false },
      totalJobsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      completedJobsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      rewardPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'Partner',
      tableName: 'partners',
      timestamps: true,
      indexes: [{ unique: true, fields: ['phone'], name: 'partners_phone_unique' }],
    },
  );
  return Partner;
}
