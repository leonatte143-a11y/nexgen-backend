import { DataTypes, Model } from 'sequelize';

export function defineEmergencyRequest(sequelize) {
  class EmergencyRequest extends Model {}
  EmergencyRequest.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      userId: { type: DataTypes.STRING(64), allowNull: false },
      userPhone: { type: DataTypes.STRING(16), allowNull: true },
      latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      status: { type: DataTypes.STRING(32), defaultValue: 'open' },
      dispatchPhone: { type: DataTypes.STRING(16), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'EmergencyRequest', tableName: 'emergency_requests', timestamps: true },
  );
  return EmergencyRequest;
}
