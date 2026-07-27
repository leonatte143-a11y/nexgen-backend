import { DataTypes, Model } from 'sequelize';

/** Ledger of 50%-of-first-job-commission credits paid to a referring Partner. */
export function definePartnerReferralEarning(sequelize) {
  class PartnerReferralEarning extends Model {}
  PartnerReferralEarning.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      referrerPartnerId: { type: DataTypes.STRING(64), allowNull: false },
      refereePartnerId: { type: DataTypes.STRING(64), allowNull: false },
      bookingId: { type: DataTypes.STRING(64), allowNull: false },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    },
    {
      sequelize,
      modelName: 'PartnerReferralEarning',
      tableName: 'partner_referral_earnings',
      timestamps: true,
      updatedAt: false,
    },
  );
  return PartnerReferralEarning;
}
