import { Notification, User } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toAppNotification } from '../serializers/mappers.js';

export async function listForUser(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const rows = await Notification.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
    });
    return sendOk(res, rows.map(toAppNotification));
  } catch (e) {
    next(e);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await Notification.update({ read: true }, { where: { userId: req.userId } });
    return sendOk(res, true);
  } catch (e) {
    next(e);
  }
}
