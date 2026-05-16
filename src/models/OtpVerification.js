import { DataTypes, Model } from 'sequelize';

export function defineOtpVerification(sequelize) {
  class OtpVerification extends Model {}
  OtpVerification.init(
    {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      phone: { type: DataTypes.STRING(15), allowNull: false },
      /** bcrypt hash of the OTP (never store plaintext). */
      otp: { type: DataTypes.STRING(255), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
      attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'OtpVerification',
      tableName: 'otp_verifications',
      timestamps: true,
      indexes: [{ fields: ['phone', 'created_at'] }],
    },
  );
  return OtpVerification;
}
