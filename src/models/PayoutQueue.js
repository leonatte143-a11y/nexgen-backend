import { DataTypes, Model } from 'sequelize';

export function definePayoutQueue(sequelize) {
  class PayoutQueue extends Model {}
  PayoutQueue.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      bankName: DataTypes.STRING(256),
      bankAccount: DataTypes.STRING(64),
      status: { type: DataTypes.STRING(32), defaultValue: 'queued' },
      weekLabel: DataTypes.STRING(32),
    },
    { sequelize, modelName: 'PayoutQueue', tableName: 'payout_queue', timestamps: true, updatedAt: false },
  );
  return PayoutQueue;
}
