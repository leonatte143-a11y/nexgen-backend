import { DataTypes, Model } from 'sequelize';

export function defineAcademyVideo(sequelize) {
  class AcademyVideo extends Model {}
  AcademyVideo.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      videoUrl: { type: DataTypes.TEXT, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'AcademyVideo', tableName: 'academy_videos', timestamps: true },
  );
  return AcademyVideo;
}

