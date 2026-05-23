import { DataTypes, Model } from 'sequelize';

export function definePartnerDocument(sequelize) {
  class PartnerDocument extends Model {}
  PartnerDocument.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      docType: { type: DataTypes.STRING(32), allowNull: false },
      fileUrl: { type: DataTypes.STRING(512), allowNull: false },
      status: { type: DataTypes.STRING(32), defaultValue: 'pending' },
    },
    { sequelize, modelName: 'PartnerDocument', tableName: 'partner_documents', timestamps: true },
  );
  return PartnerDocument;
}
