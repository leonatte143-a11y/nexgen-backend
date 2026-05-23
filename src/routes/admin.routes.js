import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.js';
import * as legacy from '../controllers/adminController.js';
import * as banner from '../controllers/bannerController.js';
import * as dash from '../controllers/admin/adminDashboardController.js';
import * as partners from '../controllers/admin/adminPartnersController.js';
import * as bookings from '../controllers/admin/adminBookingsController.js';
import * as catalog from '../controllers/admin/adminCatalogController.js';
import * as users from '../controllers/admin/adminUsersController.js';
import * as support from '../controllers/admin/adminSupportController.js';
import * as payouts from '../controllers/admin/adminPayoutsController.js';
import * as coupons from '../controllers/admin/adminCouponsController.js';
import * as notifications from '../controllers/admin/adminNotificationsController.js';
import * as settings from '../controllers/admin/adminSettingsController.js';

const r = Router();
r.use(requireAdmin);

// Dashboard
r.get('/dashboard/stats', dash.dashboardStats);
r.get('/dashboard/bookings-chart', dash.bookingsChart);
r.get('/dashboard/recent-activity', dash.recentActivity);
r.get('/search-analytics', dash.searchAnalytics);
r.get('/heatmap', dash.heatmap);

// KYC & partners
r.get('/partners', partners.listPartners);
r.get('/partners/kyc/pending', partners.listPendingKyc);
r.get('/partners/kyc/:id', partners.getPartnerKyc);
r.post('/partners/kyc/:id/approve', partners.approveKyc);
r.post('/partners/kyc/:id/reject', partners.rejectKyc);
r.put('/partners/:id', partners.updatePartner);
r.post('/partners/:id/documents', partners.uploadPartnerDocument);

// Catalog & pricing
r.get('/categories', catalog.listCategories);
r.put('/categories/:id', catalog.updateCategory);
r.post('/categories', legacy.createCategory);
r.get('/services', catalog.listServicesAdmin);
r.put('/services/:id', catalog.updateService);
r.post('/services', legacy.createService);

// Bookings
r.get('/bookings', bookings.listBookings);
r.get('/bookings/live', bookings.liveBookings);
r.put('/bookings/:id/assign', bookings.assignPartner);

// Users
r.get('/users', users.listUsersAdmin);
r.put('/users/:id/block', users.setUserBlocked);

// Support
r.get('/support/tickets', support.listTickets);
r.post('/support/tickets', support.createTicket);
r.put('/support/tickets/:id', support.updateTicket);
r.post('/support/tickets/:id/freeze-payment', support.freezePayment);
r.post('/support/tickets/:id/refund', support.triggerRefund);

// Payouts
r.get('/payouts/queue', payouts.payoutQueue);
r.post('/payouts/generate', payouts.generatePayoutFile);
r.get('/payouts/history', payouts.settlementHistory);
r.get('/payouts/commission-report', payouts.commissionReport);

// Coupons
r.get('/coupons', coupons.listCoupons);
r.post('/coupons', coupons.createCoupon);
r.put('/coupons/:id', coupons.updateCoupon);

// Notifications
r.get('/notifications', notifications.listNotificationsAdmin);
r.post('/notifications/broadcast', notifications.broadcast);

// Settings & geo
r.get('/settings', settings.getAppSettings);
r.put('/settings', settings.patchAppSettings);
r.get('/geo/zones', settings.listGeoZones);
r.post('/geo/zones', settings.upsertGeoZone);
r.post('/geo/surge', settings.setSurge);

// Banners (existing)
r.get('/banners', banner.adminListBanners);
r.post('/banners', banner.adminCreateBanner);
r.put('/banners/:id', banner.adminUpdateBanner);
r.delete('/banners/:id', banner.adminDeleteBanner);

export default r;
