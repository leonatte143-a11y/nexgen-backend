import { User } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toMockUser } from '../serializers/mappers.js';
import { ctrlLog } from '../utils/devLogger.js';
import { ensureUserReferralCode } from '../utils/referralCode.js';

export async function getMe(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    await ensureUserReferralCode(user);
    ctrlLog('PROFILE', 'getMe', req);
    return sendOk(res, toMockUser(user));
  } catch (e) {
    next(e);
  }
}

export async function deleteMe(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    await user.update({
      isBlocked: true,
      firstName: 'Deleted',
      lastName: 'User',
      email: '',
      address: '',
    });
    ctrlLog('PROFILE', 'Account deleted (soft)', req);
    return sendOk(res, { ok: true }, 'Account deleted');
  } catch (e) {
    next(e);
  }
}

export async function toggleFreeze(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const nextFrozen = !user.isFrozen;
    await user.update({ isFrozen: nextFrozen });
    ctrlLog('PROFILE', 'Account freeze toggled', req, { isFrozen: nextFrozen });
    return sendOk(res, { isFrozen: nextFrozen }, nextFrozen ? 'Account frozen' : 'Account unfrozen');
  } catch (e) {
    next(e);
  }
}

export async function updateMe(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const { firstName, lastName, email, address, rewardPoints, referralCode, phone, latitude, longitude } = req.body;
    await user.update({
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(address !== undefined && { address }),
      ...(rewardPoints !== undefined && { rewardPoints }),
      ...(referralCode !== undefined && { referralCode }),
      ...(phone !== undefined && { phone: String(phone).replace(/\D/g, '').slice(0, 10) }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
    });
    ctrlLog('PROFILE', 'Profile updated', req, { fields: Object.keys(req.body || {}) });
    return sendOk(res, toMockUser(user), 'Profile updated');
  } catch (e) {
    next(e);
  }
}
