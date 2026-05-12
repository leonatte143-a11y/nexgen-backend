import { User } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toMockUser } from '../serializers/mappers.js';

export async function getMe(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    return sendOk(res, toMockUser(user));
  } catch (e) {
    next(e);
  }
}

export async function updateMe(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const { firstName, lastName, email, address, rewardPoints, referralCode, phone } = req.body;
    await user.update({
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(address !== undefined && { address }),
      ...(rewardPoints !== undefined && { rewardPoints }),
      ...(referralCode !== undefined && { referralCode }),
      ...(phone !== undefined && { phone: String(phone).replace(/\D/g, '').slice(0, 10) }),
    });
    return sendOk(res, toMockUser(user), 'Profile updated');
  } catch (e) {
    next(e);
  }
}
