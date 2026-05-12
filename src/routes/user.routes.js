import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/userController.js';

const r = Router();
r.use(requireUser);
r.get('/me', c.getMe);
r.put('/me', c.updateMe);

export default r;
