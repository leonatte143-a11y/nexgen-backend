import { sequelize } from '../config/database.js';

export { sequelize };
import { defineUser } from './User.js';
import { definePartner } from './Partner.js';
import { defineCategory } from './Category.js';
import { defineService } from './Service.js';
import { defineBooking } from './Booking.js';
import { definePartnerServicePricing } from './PartnerServicePricing.js';
import { defineNotification } from './Notification.js';
import { defineReview } from './Review.js';
import { defineAdminUser } from './AdminUser.js';
import { defineTestimonial } from './Testimonial.js';
import { defineAcademyVideo } from './AcademyVideo.js';
import { defineFavorite } from './Favorite.js';
import { defineOtpVerification } from './OtpVerification.js';

export const User = defineUser(sequelize);
export const Partner = definePartner(sequelize);
export const Category = defineCategory(sequelize);
export const Service = defineService(sequelize);
export const Booking = defineBooking(sequelize);
export const PartnerServicePricing = definePartnerServicePricing(sequelize);
export const Notification = defineNotification(sequelize);
export const Review = defineReview(sequelize);
export const AdminUser = defineAdminUser(sequelize);
export const Testimonial = defineTestimonial(sequelize);
export const AcademyVideo = defineAcademyVideo(sequelize);
export const Favorite = defineFavorite(sequelize);
export const OtpVerification = defineOtpVerification(sequelize);

Service.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Service.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

Category.hasMany(Service, { foreignKey: 'categoryId', as: 'services' });
Partner.hasMany(Service, { foreignKey: 'partnerId', as: 'services' });

User.hasMany(Booking, { foreignKey: 'userId' });
Partner.hasMany(Booking, { foreignKey: 'partnerId' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Booking.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

Partner.hasMany(PartnerServicePricing, { foreignKey: 'partnerId' });
User.hasMany(Notification, { foreignKey: 'userId' });
Review.belongsTo(Booking, { foreignKey: 'bookingId' });

// Social proof / favorites
User.hasMany(Testimonial, { foreignKey: 'userId' });
Partner.hasMany(Testimonial, { foreignKey: 'partnerId' });
Testimonial.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Testimonial.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

User.hasMany(Favorite, { foreignKey: 'userId' });
Partner.hasMany(Favorite, { foreignKey: 'partnerId' });
Favorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Favorite.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

export async function syncDatabase({ force = false, alter = true } = {}) {
  await sequelize.sync({ force, alter });
}
