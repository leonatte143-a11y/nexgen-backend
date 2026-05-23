import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import catalogRoutes from './catalog.routes.js';
import bookingRoutes from './booking.routes.js';
import partnerRoutes from './partner.routes.js';
import notificationRoutes from './notification.routes.js';
import adminRoutes from './admin.routes.js';
import reviewRoutes from './review.routes.js';
import testimonialRoutes from './testimonial.routes.js';
import academyRoutes from './academy.routes.js';
import favoriteRoutes from './favorite.routes.js';
import bannerRoutes from './banner.routes.js';

const v1 = Router();

v1.use('/auth', authRoutes);
v1.use('/users', userRoutes);
v1.use('/catalog', catalogRoutes);
v1.use('/bookings', bookingRoutes);
v1.use('/partners', partnerRoutes);
v1.use('/notifications', notificationRoutes);
v1.use('/admin', adminRoutes);
v1.use('/reviews', reviewRoutes);
v1.use('/testimonials', testimonialRoutes);
v1.use('/academy', academyRoutes);
v1.use('/banners', bannerRoutes);
// Favorites are under /users/me/favorites (user auth)
v1.use('/users', favoriteRoutes);

const api = Router();
api.use('/v1', v1);

export { api };
