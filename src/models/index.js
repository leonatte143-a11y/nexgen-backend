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
import { defineAdvertisementBanner } from './AdvertisementBanner.js';
import { defineSearchLog } from './SearchLog.js';
import { definePartnerDocument } from './PartnerDocument.js';
import { defineSupportTicket } from './SupportTicket.js';
import { defineCoupon } from './Coupon.js';
import { defineSettlement } from './Settlement.js';
import { definePayoutQueue } from './PayoutQueue.js';
import { defineAppSetting } from './AppSetting.js';
import { defineAdminAuditLog } from './AdminAuditLog.js';
import { defineGeoZone } from './GeoZone.js';
import { defineRevenueTransaction } from './RevenueTransaction.js';
import { defineSupportConversation } from './SupportConversation.js';
import { defineSupportMessage } from './SupportMessage.js';
import { definePartnerWarning } from './PartnerWarning.js';
import { defineFraudFlag } from './FraudFlag.js';
import { defineChatSetting } from './ChatSetting.js';
import { defineStaffProfile } from './StaffProfile.js';
import { defineStaffPayroll } from './StaffPayroll.js';
import { defineBookingLineItem } from './BookingLineItem.js';
import { defineVisitingChargeRule } from './VisitingChargeRule.js';
import { defineEmergencyRequest } from './EmergencyRequest.js';

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
export const AdvertisementBanner = defineAdvertisementBanner(sequelize);
export const SearchLog = defineSearchLog(sequelize);
export const PartnerDocument = definePartnerDocument(sequelize);
export const SupportTicket = defineSupportTicket(sequelize);
export const Coupon = defineCoupon(sequelize);
export const Settlement = defineSettlement(sequelize);
export const PayoutQueue = definePayoutQueue(sequelize);
export const AppSetting = defineAppSetting(sequelize);
export const AdminAuditLog = defineAdminAuditLog(sequelize);
export const GeoZone = defineGeoZone(sequelize);
export const RevenueTransaction = defineRevenueTransaction(sequelize);
export const SupportConversation = defineSupportConversation(sequelize);
export const SupportMessage = defineSupportMessage(sequelize);
export const PartnerWarning = definePartnerWarning(sequelize);
export const FraudFlag = defineFraudFlag(sequelize);
export const ChatSetting = defineChatSetting(sequelize);
export const StaffProfile = defineStaffProfile(sequelize);
export const StaffPayroll = defineStaffPayroll(sequelize);
export const BookingLineItem = defineBookingLineItem(sequelize);
export const VisitingChargeRule = defineVisitingChargeRule(sequelize);
export const EmergencyRequest = defineEmergencyRequest(sequelize);

Service.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Service.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

Category.hasMany(Service, { foreignKey: 'categoryId', as: 'services' });
Partner.hasMany(Service, { foreignKey: 'partnerId', as: 'services' });
Partner.hasMany(PartnerDocument, { foreignKey: 'partnerId', as: 'documents' });
PartnerDocument.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

User.hasMany(Booking, { foreignKey: 'userId' });
Partner.hasMany(Booking, { foreignKey: 'partnerId' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Booking.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
Booking.hasMany(BookingLineItem, { foreignKey: 'bookingId', as: 'lineItems' });
BookingLineItem.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

Partner.hasMany(PartnerServicePricing, { foreignKey: 'partnerId' });
User.hasMany(Notification, { foreignKey: 'userId' });
Review.belongsTo(Booking, { foreignKey: 'bookingId' });
SupportMessage.belongsTo(SupportConversation, { foreignKey: 'conversationId', as: 'conversation' });
SupportConversation.hasMany(SupportMessage, { foreignKey: 'conversationId', as: 'messages' });

User.hasMany(Testimonial, { foreignKey: 'userId' });
Partner.hasMany(Testimonial, { foreignKey: 'partnerId' });
Testimonial.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Testimonial.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

User.hasMany(Favorite, { foreignKey: 'userId' });
Partner.hasMany(Favorite, { foreignKey: 'partnerId' });
Favorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Favorite.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

export async function connectDatabase({ sync = false, force = false, alter = false } = {}) {
  await sequelize.authenticate();
  if (sync) {
    await sequelize.sync({ force, alter });
  }
}

export async function syncDatabase({ force = false, alter = true } = {}) {
  await connectDatabase({ sync: true, force, alter });
}
