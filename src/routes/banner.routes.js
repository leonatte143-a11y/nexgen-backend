import { Router } from 'express';
import * as c from '../controllers/bannerController.js';

const r = Router();

r.get('/', c.listBanners);
r.get('/home', c.listHomeBanners);

export default r;
