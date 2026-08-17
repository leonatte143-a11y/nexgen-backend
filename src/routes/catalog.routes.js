import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/catalogController.js';

const r = Router();

r.get('/categories', c.listActiveCategories);
r.get('/buckets', c.getBuckets);
r.get('/services', c.getCatalog);
r.get('/buckets/:bucketId/services', c.getByBucket);
r.get('/services/:id', c.getById);
r.get('/services/:id/partners', c.getServicePartners);
r.get('/services/:id/partners/:partnerId/menu', c.getPartnerServiceMenu);
r.get('/partners/:partnerId/reviews', c.getPartnerReviews);
r.get('/visiting-charge', c.getVisitingCharge);
r.get('/search', c.search);
r.get('/top-rated', c.topRated);
r.post('/partners/:partnerId/view', requireUser, c.logProfileView);

export default r;
