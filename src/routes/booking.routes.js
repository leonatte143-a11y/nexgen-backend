import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/bookingController.js';

const r = Router();
r.use(requireUser);
r.get('/', c.listMyBookings);
r.get('/:id', c.getBooking);
r.post('/', c.createBooking);
r.post('/:id/cancel', c.cancelBooking);
r.post('/:id/review', c.submitReview);

export default r;
