import { DataTypes, Model } from 'sequelize';

export function defineTestimonial(sequelize) {
  class Testimonial extends Model {}
  Testimonial.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      userId: { type: DataTypes.STRING(64), allowNull: false },
      partnerId: { type: DataTypes.STRING(64), allowNull: false },
      videoUrl: { type: DataTypes.TEXT, allowNull: false },
    },
    { sequelize, modelName: 'Testimonial', tableName: 'testimonials', timestamps: true },
  );
  return Testimonial;
}

