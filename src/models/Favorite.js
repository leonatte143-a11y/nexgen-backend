import { DataTypes, Model } from 'sequelize';

export function defineFavorite(sequelize) {
  class Favorite extends Model {}
  Favorite.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      userId: { type: DataTypes.STRING(64), allowNull: false },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Favorite',
      tableName: 'favorites',
      timestamps: true,
      indexes: [{ unique: true, fields: ['user_id', 'partner_id'] }],
    },
  );
  return Favorite;
}

