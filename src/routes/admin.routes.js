import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.js';
import { requirePermission } from '../middlewares/rbac.js';
import { PERMISSIONS as P } from '../constants/rbac.js';
import * as legacy from '../controllers/adminController.js';
import * as banner from '../controllers/bannerController.js';
import * as dash from '../controllers/admin/adminDashboardController.js';
import * as partners from '../controllers/admin/adminPartnersController.js';
import * as compliance from '../controllers/admin/adminPartnerComplianceController.js';
import * as bookings from '../controllers/admin/adminBookingsController.js';
import * as catalog from '../controllers/admin/adminCatalogController.js';
import * as users from '../controllers/admin/adminUsersController.js';
import * as support from '../controllers/admin/adminSupportController.js';
import * as payouts from '../controllers/admin/adminPayoutsController.js';
import * as finance from '../controllers/admin/adminFinanceController.js';
import * as coupons from '../controllers/admin/adminCouponsController.js';
import * as notifications from '../controllers/admin/adminNotificationsController.js';
import * as settings from '../controllers/admin/adminSettingsController.js';
import * as audit from '../controllers/admin/adminAuditController.js';
import * as demand from '../controllers/admin/adminDemandController.js';
import * as analytics from '../controllers/admin/adminAnalyticsController.js';
import * as chat from '../controllers/admin/adminChatController.js';
import * as fraud from '../controllers/admin/adminFraudController.js';
import * as partnerPrices from '../controllers/admin/adminPartnerPricesController.js';
import * as staff from '../controllers/admin/adminStaffController.js';
import * as shops from '../controllers/admin/adminShopsController.js';
import * as meta from '../controllers/admin/adminMetaController.js';
import * as marketplace from '../controllers/admin/adminMarketplaceController.js';

const r = Router();
r.use(requireAdmin);

// Dashboard — all staff
r.get('/dashboard/stats', requirePermission(P.DASHBOARD_VIEW), dash.dashboardStats);
r.get('/dashboard/bookings-chart', requirePermission(P.DASHBOARD_VIEW), dash.bookingsChart);
r.get('/dashboard/recent-activity', requirePermission(P.DASHBOARD_VIEW), dash.recentActivity);
r.get('/dashboard/partner-performance', requirePermission(P.DASHBOARD_VIEW), dash.partnerPerformance);
r.get('/dashboard/financial-breakdown', requirePermission(P.REVENUE_VIEW), dash.financialBreakdown);
r.get('/dashboard/financial-pipeline', requirePermission(P.REVENUE_VIEW), dash.financialPipeline);
r.get('/dashboard/user-growth', requirePermission(P.ANALYTICS_VIEW), dash.userGrowth);
r.get('/dashboard/reviews-sentiment', requirePermission(P.DASHBOARD_VIEW), dash.reviewsSentiment);
r.get('/dashboard/support-chat-summary', requirePermission(P.SUPPORT_MANAGE), dash.supportChatSummary);
r.get('/dashboard/alerts', requirePermission(P.DASHBOARD_VIEW), dash.dashboardAlerts);
r.get('/search-analytics', requirePermission(P.DEMAND_ANALYTICS), dash.searchAnalytics);
r.get('/heatmap', requirePermission(P.DEMAND_ANALYTICS), dash.heatmap);

// Audit
r.get('/audit-logs', requirePermission(P.AUDIT_VIEW), audit.listAuditLogs);

// Demand analytics
r.get('/demand-analytics', requirePermission(P.DEMAND_ANALYTICS), demand.listDemandAnalytics);
r.get('/demand-analytics/summary', requirePermission(P.DEMAND_ANALYTICS), demand.demandAnalyticsSummary);

// Analytics power center
r.get('/analytics', requirePermission(P.ANALYTICS_VIEW), analytics.getAnalytics);

// Service zones — admin only establish
r.post('/service-zones', requirePermission(P.ESTABLISH_LOCATION), analytics.establishServiceZone);

// KYC & partners
r.get('/partners', requirePermission(P.PARTNERS_MANAGE), partners.listPartners);
r.get('/partners/kyc/pending', requirePermission(P.KYC_MANAGE), partners.listPendingKyc);
r.get('/partners/kyc/:id', requirePermission(P.KYC_MANAGE), partners.getPartnerKyc);
r.post('/partners/kyc/:id/approve', requirePermission(P.KYC_MANAGE), partners.approveKyc);
r.post('/partners/kyc/:id/reject', requirePermission(P.KYC_MANAGE), partners.rejectKyc);
r.put('/partners/:id', requirePermission(P.PARTNERS_MANAGE), partners.updatePartner);
r.post('/partners/:id/documents', requirePermission(P.KYC_MANAGE), partners.uploadPartnerDocument);
r.post('/partners/:id/warn', requirePermission(P.PARTNERS_COMPLIANCE), compliance.warnPartner);
r.post('/partners/:id/freeze', requirePermission(P.PARTNERS_COMPLIANCE), compliance.freezePartner);
r.post('/partners/:id/unfreeze', requirePermission(P.PARTNERS_COMPLIANCE), compliance.unfreezePartner);
r.post('/partners/:id/block', requirePermission(P.PARTNERS_COMPLIANCE), compliance.blockPartner);
r.post('/partners/:id/archive', requirePermission(P.PARTNERS_COMPLIANCE), compliance.archivePartner);
r.post('/partners/:id/restore', requirePermission(P.PARTNERS_COMPLIANCE), compliance.restorePartner);
r.get('/partners/archived', requirePermission(P.PARTNERS_COMPLIANCE), compliance.listArchivedPartners);
r.get('/hover-meta', requirePermission(P.DASHBOARD_VIEW, P.PARTNERS_MANAGE, P.USERS_MANAGE, P.STAFF_MANAGE), meta.getHoverMeta);
r.get('/partners/strike-board', requirePermission(P.PARTNERS_COMPLIANCE), compliance.strikeBoard);

// Partner price review
r.get('/partner-prices/pending', requirePermission(P.PRICING_MANAGE), partnerPrices.listPendingPartnerPrices);
r.post('/partner-prices/:id/approve', requirePermission(P.PRICING_MANAGE), partnerPrices.approvePartnerPrice);
r.post('/partner-prices/:id/reject', requirePermission(P.PRICING_MANAGE), partnerPrices.rejectPartnerPrice);

// Staff directory
r.get('/staff', requirePermission(P.STAFF_MANAGE, P.PAYROLL_VIEW), staff.listStaff);
r.post('/staff', requirePermission(P.STAFF_MANAGE), staff.createStaff);
r.put('/staff/:id', requirePermission(P.STAFF_MANAGE), staff.updateStaff);

// Catalog & pricing
r.get('/categories', requirePermission(P.SERVICES_MANAGE, P.DASHBOARD_VIEW), catalog.listCategories);
r.put('/categories/:id', requirePermission(P.PRICING_MANAGE, P.SERVICES_MANAGE), catalog.updateCategory);
r.post('/categories', requirePermission(P.SERVICES_MANAGE, P.PRICING_MANAGE), catalog.createCategory);
r.delete('/categories/:id', requirePermission(P.PRICING_MANAGE, P.SERVICES_MANAGE), catalog.deleteCategory);
r.get('/services', requirePermission(P.SERVICES_MANAGE, P.DASHBOARD_VIEW), catalog.listServicesAdmin);
r.put('/services/:id', requirePermission(P.PRICING_MANAGE, P.SERVICES_MANAGE), catalog.updateService);
r.post('/services', requirePermission(P.SERVICES_MANAGE, P.PRICING_MANAGE), catalog.createCatalogService);
r.delete('/services/:id', requirePermission(P.SERVICES_MANAGE), legacy.deleteService);

// Bookings (static paths before :id)
r.get('/bookings', requirePermission(P.BOOKINGS_MANAGE), bookings.listBookings);
r.get('/bookings/live', requirePermission(P.LIVE_MONITOR), bookings.liveBookings);
r.get('/bookings/online-partners', requirePermission(P.BOOKINGS_REASSIGN), bookings.onlinePartnersForReassign);
r.get('/bookings/:id', requirePermission(P.BOOKINGS_MANAGE), bookings.getBookingDetail);
r.put('/bookings/:id/assign', requirePermission(P.BOOKINGS_MANAGE), bookings.assignPartner);
r.post('/bookings/:bookingId/reassign', requirePermission(P.BOOKINGS_REASSIGN), bookings.reassignPartner);

// Users
r.get('/users', requirePermission(P.USERS_MANAGE), users.listUsersAdmin);
r.put('/users/:id/block', requirePermission(P.USERS_MANAGE), users.setUserBlocked);

// Support / disputes
r.get('/disputes', requirePermission(P.SUPPORT_MANAGE), support.listTickets);
r.get('/support/tickets', requirePermission(P.SUPPORT_MANAGE), support.listTickets);
r.post('/support/tickets', requirePermission(P.SUPPORT_MANAGE), support.createTicket);
r.put('/support/tickets/:id', requirePermission(P.SUPPORT_MANAGE), support.updateTicket);
r.post('/support/tickets/:id/freeze-payment', requirePermission(P.SUPPORT_MANAGE), support.freezePayment);
r.post('/disputes/:id/freeze-payment', requirePermission(P.SUPPORT_MANAGE), support.freezePayment);
r.post('/support/tickets/:id/refund', requirePermission(P.SUPPORT_MANAGE), support.triggerRefund);
r.post('/disputes/:id/refund', requirePermission(P.SUPPORT_MANAGE), support.triggerRefund);

// Payouts (legacy + finance module)
r.get('/payouts/queue', requirePermission(P.PAYOUTS_MANAGE), payouts.payoutQueue);
r.post('/payouts/generate', requirePermission(P.PAYOUTS_MANAGE), payouts.generatePayoutFile);
r.get('/payouts/history', requirePermission(P.PAYOUTS_MANAGE), payouts.settlementHistory);
r.get('/payouts/commission-report', requirePermission(P.PAYOUTS_MANAGE), payouts.commissionReport);
r.post('/payouts/:id/approve', requirePermission(P.PAYOUTS_MANAGE), payouts.approvePayoutRequest);
r.post('/payouts/:id/reject', requirePermission(P.PAYOUTS_MANAGE), payouts.rejectPayoutRequest);
r.get('/finance/payouts', requirePermission(P.PAYOUTS_MANAGE), finance.listFinancePayouts);
r.post('/finance/payouts/generate', requirePermission(P.PAYOUTS_MANAGE), finance.generateFinancePayout);
r.post('/finance/payouts/:id/mark-paid', requirePermission(P.PAYOUTS_MANAGE), finance.markPayoutPaid);
r.get('/finance/wallet-history', requirePermission(P.PAYOUTS_MANAGE), finance.walletHistory);
r.get('/finance/payroll', requirePermission(P.PAYROLL_VIEW), finance.listStaffPayroll);
r.post('/finance/payroll/calculate', requirePermission(P.PAYROLL_VIEW), finance.calculateStaffPayroll);

// Coupons & marketing
r.get('/coupons', requirePermission(P.MARKETING_MANAGE), coupons.listCoupons);
r.post('/coupons', requirePermission(P.MARKETING_MANAGE), coupons.createCoupon);
r.put('/coupons/:id', requirePermission(P.MARKETING_MANAGE), coupons.updateCoupon);
r.delete('/coupons/:id', requirePermission(P.MARKETING_MANAGE), coupons.deleteCoupon);
r.get('/referrals', requirePermission(P.MARKETING_MANAGE), coupons.listReferrals);
r.post('/notifications/targeted', requirePermission(P.MARKETING_MANAGE), notifications.targetedNotification);

// Notifications
r.get('/notifications/campaigns', requirePermission(P.NOTIFICATIONS_BROADCAST), notifications.listNotificationCampaigns);
r.post('/notifications/campaigns/:id/deactivate', requirePermission(P.NOTIFICATIONS_BROADCAST), notifications.deactivateCampaign);
r.get('/notifications', requirePermission(P.NOTIFICATIONS_BROADCAST), notifications.listNotificationsAdmin);
r.post('/notifications/broadcast', requirePermission(P.NOTIFICATIONS_BROADCAST), notifications.broadcast);

// Chat monitor
r.get('/chats', requirePermission(P.CHAT_MONITOR), chat.listChats);
r.get('/chats/alerts', requirePermission(P.CHAT_MONITOR), chat.chatAlerts);
r.get('/chats/:id', requirePermission(P.CHAT_MONITOR), chat.getChat);
r.post('/chats/:id/join', requirePermission(P.CHAT_MONITOR), chat.joinChat);
r.post('/chats/:id/messages', requirePermission(P.CHAT_MONITOR), chat.sendAdminMessage);
r.put('/chats/settings', requirePermission(P.SETTINGS_MANAGE), chat.updateChatSettings);

// Fraud
r.get('/fraud-flags', requirePermission(P.FRAUD_VIEW), fraud.listFraudFlags);
r.post('/fraud-flags/scan', requirePermission(P.FRAUD_VIEW), fraud.scanFraudSignals);

// Settings & geo
r.get('/settings', requirePermission(P.SETTINGS_MANAGE), settings.getAppSettings);
r.put('/settings', requirePermission(P.SETTINGS_MANAGE), settings.patchAppSettings);
r.get('/settings/maps-key', requirePermission(P.SETTINGS_MANAGE), settings.getMapsApiKeySetting);
r.put('/settings/maps-key', requirePermission(P.SETTINGS_MANAGE), settings.patchMapsApiKeySetting);
r.get('/geo/zones', requirePermission(P.SETTINGS_MANAGE, P.DEMAND_ANALYTICS), settings.listGeoZones);
r.post('/geo/zones', requirePermission(P.ESTABLISH_LOCATION), settings.upsertGeoZone);
r.post('/geo/surge', requirePermission(P.SETTINGS_MANAGE), settings.setSurge);

// Banners
r.get('/banners', requirePermission(P.MARKETING_MANAGE), banner.adminListBanners);
r.post('/banners', requirePermission(P.MARKETING_MANAGE), banner.adminCreateBanner);
r.put('/banners/:id', requirePermission(P.MARKETING_MANAGE), banner.adminUpdateBanner);
r.delete('/banners/:id', requirePermission(P.MARKETING_MANAGE), banner.adminDeleteBanner);
r.post('/banners/:id/approve', requirePermission(P.MARKETING_MANAGE), banner.adminApproveBanner);
r.post('/banners/:id/reject', requirePermission(P.MARKETING_MANAGE), banner.adminRejectBanner);

// Shops & marketplace
r.get('/shops/pending', requirePermission(P.SHOPS_VERIFY, P.SHOPS_MANAGE), shops.listPending);
r.get('/shops/leads', requirePermission(P.SHOPS_VERIFY, P.SHOPS_MANAGE), shops.leadStats);
r.get('/shops', requirePermission(P.SHOPS_VERIFY, P.SHOPS_MANAGE), shops.listShops);
r.post('/shops/:id/approve', requirePermission(P.SHOPS_VERIFY, P.SHOPS_MANAGE), shops.approveShop);
r.post('/shops/:id/reject', requirePermission(P.SHOPS_VERIFY, P.SHOPS_MANAGE), shops.rejectShop);
r.post('/shops/:id/featured', requirePermission(P.SHOPS_MANAGE), shops.setFeatured);
r.get('/shop-categories', requirePermission(P.SHOPS_VERIFY, P.SHOPS_MANAGE), shops.listCategories);
r.post('/shop-categories', requirePermission(P.SHOPS_MANAGE), shops.createCategory);
r.put('/shop-categories/:id', requirePermission(P.SHOPS_MANAGE), shops.updateCategory);

// P2P Marketplace moderation
r.get('/marketplace/listings', requirePermission(P.MARKETPLACE_MODERATE), marketplace.adminListListings);
r.get('/marketplace/reports', requirePermission(P.MARKETPLACE_MODERATE), marketplace.adminListReports);
r.post('/marketplace/listings/:id/ban', requirePermission(P.MARKETPLACE_MODERATE), marketplace.adminBanListing);
r.delete('/marketplace/listings/:id', requirePermission(P.MARKETPLACE_MODERATE), marketplace.adminDeleteListing);

export default r;
