import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { requireAdmin } from '../middlewares/auth.js';

const r = Router();

r.post('/otp/request', auth.requestOtp);
r.post('/otp/verify', auth.verifyOtpUser);
r.post('/firebase/verify', auth.verifyFirebaseUser);
r.post('/firebase/partner-login', auth.firebasePartnerLogin);
r.post('/partner/login', auth.partnerLogin);
r.post('/partner/register', auth.registerPartner);
r.post('/register', auth.registerUserProfile);
r.post('/admin/login', auth.adminLogin);
r.post('/admin/change-password', requireAdmin, auth.adminChangePassword);
r.post('/logout', auth.logout);

export default r;
