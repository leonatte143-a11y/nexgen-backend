import { Router } from 'express';
import { requireUser } from '../middlewares/auth.js';
import * as c from '../controllers/favoriteController.js';

const r = Router();
r.use(requireUser);
r.get('/me/favorites', c.listMyFavorites);
r.post('/me/favorites', c.addFavorite);
r.delete('/me/favorites/:partnerId', c.removeFavorite);

export default r;

