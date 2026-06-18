import { DataTypes, Model } from 'sequelize';

export function defineArchivedPartner(sequelize) {
  class ArchivedPartner extends Model {}

  ArchivedPartner.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      archivedBy: { type: DataTypes.STRING(64), allowNull: true },
      archivedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      modelName: 'ArchivedPartner',
      tableName: 'archived_partners',
      timestamps: true,
      updatedAt: false,
    },
  );

  return ArchivedPartner;
}
