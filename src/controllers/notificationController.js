import { Op } from 'sequelize';
import { Notification, User } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toAppNotification } from '../serializers/mappers.js';

export async function listForUser(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const now = new Date();
    const rows = await Notification.findAll({
      where: {
        userId: user.id,
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
      },
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

export async function markOneRead(req, res, next) {
  try {
    const row = await Notification.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!row) return sendFail(res, 'Notification not found', 404);
    if (!row.read) await row.update({ read: true });
    return sendOk(res, toAppNotification(row));
  } catch (e) {
    next(e);
  }
}

/** GET /partners/enquiries — profile-view "enquiry" notifications for the authenticated partner. */
export async function listEnquiries(req, res, next) {
  try {
    const rows = await Notification.findAll({
      where: { partnerId: req.partnerId, type: 'enquiry' },
      order: [['createdAt', 'DESC']],
    });
    return sendOk(
      res,
      rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt,
        payload: n.payload || null,
      })),
    );
  } catch (e) {
    next(e);
  }
}
