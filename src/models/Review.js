import { DataTypes, Model } from 'sequelize';

export function defineReview(sequelize) {
  class Review extends Model {}
  Review.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      bookingId: { type: DataTypes.STRING(64), allowNull: false },
      userId: { type: DataTypes.STRING(64), allowNull: false },
      serviceId: { type: DataTypes.STRING(64), allowNull: false },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      stars: { type: DataTypes.INTEGER, allowNull: false },
      tags: DataTypes.JSON,
      note: DataTypes.TEXT,
      pointsEarned: { type: DataTypes.INTEGER, defaultValue: 10 },
    },
    {
      sequelize,
      modelName: 'Review',
      tableName: 'reviews',
      timestamps: true,
      // Use DB column name (underscored) — sync emits `bookingId` literally otherwise
      indexes: [{ unique: true, fields: [{ name: 'booking_id' }], name: 'reviews_booking_id_unique' }],
    },
  );
  return Review;
}
