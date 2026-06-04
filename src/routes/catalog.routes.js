import { Router } from 'express';
import * as c from '../controllers/catalogController.js';

const r = Router();

r.get('/buckets', c.getBuckets);
r.get('/services', c.getCatalog);
r.get('/buckets/:bucketId/services', c.getByBucket);
r.get('/services/:id', c.getById);
r.get('/services/:id/partners', c.getServicePartners);
r.get('/services/:id/partners/:partnerId/menu', c.getPartnerServiceMenu);
r.get('/visiting-charge', c.getVisitingCharge);
r.get('/search', c.search);
r.get('/top-rated', c.topRated);

export default r;
