import { DataTypes, Model } from 'sequelize';

/**
 * One row serves both user `Booking` and partner `PartnerRequest` views (different serializers).
 */
export function defineBooking(sequelize) {
  class Booking extends Model {}
  Booking.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      userId: { type: DataTypes.STRING(64), allowNull: false },
      serviceId: { type: DataTypes.STRING(64), allowNull: false },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      userStatus: { type: DataTypes.STRING(32), allowNull: false },
      partnerStatus: { type: DataTypes.STRING(32), allowNull: false },
      serviceName: DataTypes.STRING(256),
      categoryLabel: DataTypes.STRING(128),
      partnerName: DataTypes.STRING(256),
      partnerRating: { type: DataTypes.DECIMAL(3, 2) },
      customerName: DataTypes.STRING(256),
      address: DataTypes.TEXT,
      notes: DataTypes.TEXT,
      totalAmount: { type: DataTypes.DECIMAL(12, 2) },
      visitingFee: { type: DataTypes.DECIMAL(10, 2) },
      adminCommission: { type: DataTypes.DECIMAL(10, 2) },
      partnerShare: { type: DataTypes.DECIMAL(12, 2) },
      startOtp: DataTypes.STRING(8),
      endOtp: DataTypes.STRING(8),
      customRequirements: DataTypes.TEXT,
      paymentStatus: { type: DataTypes.STRING(32), defaultValue: 'pending' },
      workDoneRequested: { type: DataTypes.BOOLEAN, defaultValue: false },
      scheduledAt: DataTypes.STRING(64),
      scheduledAtIso: DataTypes.DATE,
      etaMins: DataTypes.INTEGER,
      extraServices: DataTypes.JSON,
      heavyWorkEstimate: DataTypes.JSON,
      pendingEstimateAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      visitingFeePartner: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      isPartnerArrived: { type: DataTypes.BOOLEAN, defaultValue: false },
      paymentMethod: DataTypes.STRING(64),
      promoCode: DataTypes.STRING(32),
      amountOverride: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      serviceNameOverride: DataTypes.STRING(256),
      itemsSubtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      promoDiscount: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
      distanceKm: { type: DataTypes.DECIMAL(6, 2), defaultValue: 2.5 },
      /** Display label for "requested at" in partner list */
      requestedAtLabel: DataTypes.STRING(64),
      /** Reason the partner gave when cancelling an accepted/in-progress job */
      cancellationReason: { type: DataTypes.STRING(256), allowNull: true },
    },
    { sequelize, modelName: 'Booking', tableName: 'bookings', timestamps: true },
  );
  return Booking;
}
