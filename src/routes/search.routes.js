import { Router } from 'express';
import { trackSearch } from '../controllers/searchController.js';

const r = Router();
r.post('/track', trackSearch);

export default r;
