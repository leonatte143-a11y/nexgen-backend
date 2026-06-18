import { Router } from 'express';
import { optionalUser, requirePartner } from '../middlewares/auth.js';
import * as c from '../controllers/shopController.js';

const r = Router();

r.get('/categories', c.listCategories);
r.get('/trending-suggestions', c.trendingSuggestions);
r.get('/nearby', optionalUser, c.listNearby);
r.get('/:id', c.getShop);
r.post('/apply', c.applyShop);
r.post('/:id/call', c.trackCall);
r.post('/:id/directions', c.trackDirections);
r.post('/:id/refer', requirePartner, c.referShop);

export default r;
