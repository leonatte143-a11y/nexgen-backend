import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/userController.js';
import * as support from '../controllers/userSupportController.js';

const r = Router();
r.use(requireUser);
r.get('/me', c.getMe);
r.put('/me', c.updateMe);
r.get('/support/tickets', support.listMyTickets);
r.post('/support/tickets', support.createTicket);

export default r;
