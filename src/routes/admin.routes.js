import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.js';
import * as c from '../controllers/adminController.js';

const r = Router();
r.use(requireAdmin);
r.post('/categories', c.createCategory);
r.post('/services', c.createService);
r.get('/services', c.listAllServices);
r.get('/users', c.listUsers);

export default r;
