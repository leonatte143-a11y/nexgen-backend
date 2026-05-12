import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/reviewController.js';

const r = Router();
r.use(requireUser);
r.post('/', c.createReview);

export default r;

