import { Router } from 'express';
import * as c from '../controllers/configController.js';

const r = Router();

r.get('/', c.getPublicConfig);

export default r;
