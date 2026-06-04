import { DataTypes, Model } from 'sequelize';

export function defineBookingLineItem(sequelize) {
  class BookingLineItem extends Model {}
  BookingLineItem.init(
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      bookingId: { type: DataTypes.STRING(64), allowNull: false },
      serviceItemId: { type: DataTypes.STRING(64), allowNull: true },
      title: { type: DataTypes.STRING(256), allowNull: false },
      unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    },
    { sequelize, modelName: 'BookingLineItem', tableName: 'booking_line_items', timestamps: true },
  );
  return BookingLineItem;
}
