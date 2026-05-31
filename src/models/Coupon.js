import { DataTypes, Model } from 'sequelize';

export function defineCoupon(sequelize) {
  class Coupon extends Model {}
  Coupon.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      code: { type: DataTypes.STRING(32), allowNull: false },
      discountType: { type: DataTypes.STRING(16), defaultValue: 'flat' },
      discountValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      minOrderAmount: DataTypes.DECIMAL(10, 2),
      maxUses: DataTypes.INTEGER,
      usedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      city: DataTypes.STRING(128),
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
      expiresAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'Coupon',
      tableName: 'coupons',
      timestamps: true,
      indexes: [{ unique: true, fields: ['code'], name: 'coupons_code_unique' }],
    },
  );
  return Coupon;
}
