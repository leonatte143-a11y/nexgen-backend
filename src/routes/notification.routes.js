import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/notificationController.js';

const r = Router();
r.use(requireUser);
r.get('/', c.listForUser);
r.post('/read-all', c.markAllRead);
r.post('/:id/read', c.markOneRead);

export default r;
