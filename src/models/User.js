import { DataTypes, Model } from 'sequelize';

export function defineUser(sequelize) {
  class User extends Model {}
  User.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      phone: { type: DataTypes.STRING(16), unique: true, allowNull: false },
      firstName: DataTypes.STRING(128),
      lastName: DataTypes.STRING(128),
      email: DataTypes.STRING(256),
      address: DataTypes.TEXT,
      rewardPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
      referralCode: DataTypes.STRING(32),
    },
    { sequelize, modelName: 'User', tableName: 'users', timestamps: true },
  );
  return User;
}
