import bcrypt from 'bcryptjs';
import { User, AdminUser, Partner } from '../models/index.js';
import { issueOtp, verifyOtpRecord, getOtpDigitLength } from '../services/otpService.js';
import { signToken } from '../utils/jwt.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toMockUser, toPartnerProfile } from '../serializers/mappers.js';
import { upsertPartnerRegistration } from './partnerController.js';
import { ctrlLog } from '../utils/devLogger.js';
import { buildReferralCode, ensureUserReferralCode } from '../utils/referralCode.js';

function normalizePhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length !== 10) return null;
  return d;
}

/**
 * Mobile: authService.requestOtp
 */
export async function requestOtp(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) {
      return sendFail(res, 'Enter a valid 10-digit number.', 400);
    }
    const { plain, expiresAt } = await issueOtp(phone);
    const ttlSec = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 1000));
    ctrlLog('AUTH', 'OTP requested', req, { phoneLast4: phone.slice(-4), ttlSec });
    const otpLength = getOtpDigitLength();
    const data = { ok: true, expiresInSec: ttlSec, otpLength };
    // if (process.env.NODE_ENV !== 'production' && process.env.OTP_DEBUG_RESPONSE === 'true') {
      data.debugOtp = plain;
    // }
    if (process.env.NODE_ENV !== 'production' && process.env.OTP_DEBUG_RESPONSE === 'true') {
      // eslint-disable-next-line no-console
      console.info(`[otp-debug] ${phone} OTP=${plain} (disable OTP_DEBUG_RESPONSE in production)`);
    }
    return sendOk(res, data, 'OTP sent.');
  } catch (e) {
    if (e.status && e.message) {
      return sendFail(res, e.message, e.status, {
        code: e.code,
        retryAfterSec: e.retryAfterSec,
      });
    }
    next(e);
  }
}

/**
 * Mobile: authService.verifyOtp
 */
export async function verifyOtpUser(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || '').replace(/\D/g, '');
    const digits = getOtpDigitLength();
    if (!phone) return sendFail(res, 'Enter a valid 10-digit number.', 400);
    if (otp.length !== digits) {
      return sendFail(res, `Enter the ${digits}-digit OTP.`, 400);
    }
    const v = await verifyOtpRecord(phone, otp);
    if (!v.ok) {
      ctrlLog('AUTH', 'OTP verify failed', req, { reason: v.reason, phoneLast4: phone.slice(-4) });
      return res.status(200).json({
        success: true,
        data: {
          ok: false,
          message: v.message,
          code: v.reason,
          ...(v.attemptsLeft != null ? { attemptsLeft: v.attemptsLeft } : {}),
        },
        message: '',
      });
    }
    const id = `user_${phone}`;
    const [user] = await User.findOrCreate({
      where: { phone },
      defaults: {
        id,
        phone,
        firstName: '',
        lastName: '',
        email: '',
        address: '',
        rewardPoints: 0,
        referralCode: buildReferralCode({ phone, id }),
      },
    });
    await ensureUserReferralCode(user);
    if (user.isBlocked) {
      ctrlLog('AUTH', 'OTP verify blocked user', req, { userId: user.id, phoneLast4: phone.slice(-4) });
      return res.status(200).json({
        success: true,
        data: { ok: false, message: 'This account is blocked. Contact NEXGEN support.' },
        message: '',
      });
    }
    const token = signToken({ sub: user.id, phone }, 'user');
    ctrlLog('AUTH', 'OTP verified — user logged in', req, { userId: user.id, phoneLast4: phone.slice(-4) });
    return res.json({
      success: true,
      data: {
        ok: true,
        token,
        message: 'Logged in.',
        user: toMockUser(user),
      },
      message: '',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Mobile: authService.partnerLogin
 */
export async function partnerLogin(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || '').replace(/\D/g, '');
    const digits = getOtpDigitLength();
    if (!phone) {
      return res.json({
        success: true,
        data: { ok: false, message: 'Enter a valid 10-digit number.' },
        message: '',
      });
    }
    if (otp.length !== digits) {
      return res.json({
        success: true,
        data: { ok: false, message: `Enter the ${digits}-digit OTP.` },
        message: '',
      });
    }
    const v = await verifyOtpRecord(phone, otp);
    if (!v.ok) {
      return res.json({
        success: true,
        data: { ok: false, message: v.message, code: v.reason },
        message: '',
      });
    }
    const partner = await Partner.findOne({ where: { phone } });
    if (!partner) {
      ctrlLog('AUTH', 'Partner login — no account', req, { phoneLast4: phone.slice(-4) });
      return res.json({
        success: true,
        data: {
          ok: false,
          message: 'No partner account for this number. Complete partner registration first.',
        },
        message: '',
      });
    }
    const token = signToken({ sub: partner.id, phone }, 'partner');
    ctrlLog('AUTH', 'Partner logged in', req, { partnerId: partner.id, phoneLast4: phone.slice(-4) });
    return res.json({
      success: true,
      data: {
        ok: true,
        token,
        message: 'Logged in.',
        partner: toPartnerProfile(partner),
      },
      message: '',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Mobile: authService.registerPartner — new partner only (409 if phone exists)
 */
export async function registerPartner(req, res, next) {
  try {
    const { partner, created } = await upsertPartnerRegistration(req.body, { allowUpdate: false });
    ctrlLog('AUTH', 'Partner registered', req, {
      partnerId: partner.id,
      created,
      phoneLast4: partner.phone.slice(-4),
    });
    return sendOk(res, { partner: toPartnerProfile(partner), created }, 'Partner registered');
  } catch (e) {
    if (e.status && e.message) return sendFail(res, e.message, e.status);
    next(e);
  }
}

/**
 * Mobile: authService.registerProfile — public upsert for onboarding
 */
export async function registerUserProfile(req, res, next) {
  try {
    const { phone, firstName, lastName, email, address, referralCode } = req.body;
    const p = normalizePhone(phone);
    if (!p) return sendFail(res, 'Valid phone is required', 400);
    const id = `user_${p}`;
    const [u, created] = await User.findOrCreate({
      where: { phone: p },
      defaults: {
        id,
        phone: p,
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
        address: address || '',
        rewardPoints: 0,
        referralCode: referralCode || buildReferralCode({ phone: p, id }),
      },
    });
    if (!created) {
      await u.update({
        firstName: firstName ?? u.firstName,
        lastName: lastName ?? u.lastName,
        email: email ?? u.email,
        address: address ?? u.address,
        ...(referralCode !== undefined && { referralCode }),
      });
    }
    await ensureUserReferralCode(u);
    return sendOk(res, toMockUser(u), 'Profile registered');
  } catch (e) {
    next(e);
  }
}

/**
 * Optional: admin login (web / tools)
 */
export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    const admin = await AdminUser.findOne({ where: { email: String(email).toLowerCase() } });
    if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
      return sendFail(res, 'Invalid credentials', 401);
    }
    const staffRole = admin.role || 'admin';
    const token = signToken(
      { sub: admin.id, email: admin.email, adminRole: staffRole },
      'admin',
    );
    return sendOk(
      res,
      {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name || 'NEXGEN Admin',
          role: admin.role || 'super_admin',
        },
      },
      'ok',
    );
  } catch (e) {
    next(e);
  }
}

export async function logout(req, res) {
  return sendOk(res, true, 'Logged out');
}
