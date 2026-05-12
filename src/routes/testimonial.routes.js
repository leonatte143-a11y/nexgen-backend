import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/testimonialController.js';

const r = Router();
r.use(requireUser);
r.post('/', c.createTestimonial);

export default r;

