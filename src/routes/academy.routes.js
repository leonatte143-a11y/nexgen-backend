import { Router } from 'express';
import * as c from '../controllers/academyController.js';

const r = Router();
r.get('/videos', c.listAcademyVideos);

export default r;

