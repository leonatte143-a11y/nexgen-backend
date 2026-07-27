import { Router } from 'express';
import { requirePartner } from '../middlewares/auth.js';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/partnerController.js';
import * as emergency from '../controllers/emergencyController.js';
import * as shopC from '../controllers/shopController.js';
import { listPartnerReviews } from '../controllers/reviewController.js';
import { listPartnerTestimonials } from '../controllers/testimonialController.js';
import * as support from '../controllers/partnerSupportController.js';

const r = Router();

r.get('/:id/reviews', requireUser, listPartnerReviews);
r.get('/:id/testimonials', requireUser, listPartnerTestimonials);
r.post('/onboarding', c.applyOnboarding);

r.use(requirePartner);
r.get('/profile', c.getProfile);
r.put('/profile', c.updateProfile);
r.get('/requests', c.getRequests);
r.get('/earnings', c.getEarnings);
r.post('/online', c.toggleOnline);
r.post('/requests/:id/accept', c.acceptRequest);
r.post('/requests/:id/reject', c.rejectRequest);
r.post('/requests/:id/arrive', c.markArrived);
r.post('/requests/:id/start', c.startJob);
r.post('/requests/:id/work-done', c.markWorkDone);
r.post('/requests/:id/complete', c.completeJob);
r.post('/requests/:id/estimate', c.submitEstimateUpdate);
r.post('/requests/:id/cancel-fee', c.cancelActiveJobWithFee);
r.post('/requests/:id/heavy-estimate', c.requestHeavyWorkEstimate);
r.post('/requests/:id/decline-heavy', c.declineHeavyWorkEstimate);
r.post('/withdraw', c.withdrawBalance);
r.get('/emergency/active', emergency.listPartnerEmergencies);
r.get('/shops/nearby', shopC.listNearbyForPartner);
r.get('/pricing/limits', c.getPricingLimits);
r.get('/pricing', c.getPricingRows);
r.put('/pricing/:id', c.updatePricingRow);
r.post('/pricing', c.addPricingRow);
r.delete('/pricing/:id', c.deletePricingRow);
r.post('/support/chat', support.startOrGetConversation);
r.post('/support/chat/:id/messages', support.sendPartnerMessage);

export default r;
