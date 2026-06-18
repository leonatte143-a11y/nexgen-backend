import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { Notification, User, NotificationCampaign } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';

export async function broadcast(req, res, next) {
  try {
    const { title, body, city, type = 'offer' } = req.body;
    if (!title || !body) return sendFail(res, 'title and body required', 400);
    const users = await User.findAll({ attributes: ['id'] });
    let count = 0;
    for (const u of users.slice(0, 500)) {
      await Notification.create({
        id: `n_${randomUUID().slice(0, 10)}`,
        userId: u.id,
        type,
        title,
        body: city ? `${body} (${city})` : body,
        read: false,
        timeLabel: 'now',
      });
      count += 1;
    }

    const isLiveType = ['alert', 'order', 'health', 'live'].includes(String(type).toLowerCase());
    await NotificationCampaign.create({
      id: `nc_${randomUUID().slice(0, 10)}`,
      title,
      body: city ? `${body} (${city})` : body,
      type: isLiveType ? 'live' : 'offer',
      city: city || null,
      totalSent: count,
      deliveredCount: count,
      isActive: isLiveType,
      createdBy: req.adminId || null,
    });

    await recordAdminAction(req.adminId, 'notification_broadcast', { meta: { count, city } });
    return sendOk(res, { sent: count }, 'Broadcast sent');
  } catch (e) {
    next(e);
  }
}

export async function targetedNotification(req, res, next) {
  try {
    const { title, body, inactiveDays = 30 } = req.body;
    if (!title || !body) return sendFail(res, 'title and body required', 400);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - inactiveDays);
    const { Booking } = await import('../../models/index.js');
    const recentBookings = await Booking.findAll({
      where: { createdAt: { [Op.gte]: cutoff } },
      attributes: ['userId'],
    });
    const activeUserIds = new Set(recentBookings.map((b) => b.userId));
    const users = await User.findAll({ attributes: ['id'] });
    const targets = users.filter((u) => !activeUserIds.has(u.id));
    let count = 0;
    for (const u of targets.slice(0, 500)) {
      await Notification.create({
        id: `n_${randomUUID().slice(0, 10)}`,
        userId: u.id,
        type: 'offer',
        title,
        body,
        read: false,
        timeLabel: 'now',
      });
      count += 1;
    }
    await recordAdminAction(req.adminId, 'notification_targeted', { meta: { count, inactiveDays }, req });
    return sendOk(res, { sent: count, inactiveDays }, 'Targeted notifications sent');
  } catch (e) {
    next(e);
  }
}

export async function listNotificationsAdmin(req, res, next) {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const rows = await Notification.findAll({ order: [['createdAt', 'DESC']], limit });
    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function listNotificationCampaigns(_req, res, next) {
  try {
    const rows = await NotificationCampaign.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return sendOk(
      res,
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        type: r.type,
        city: r.city,
        totalSent: r.totalSent,
        delivered: r.deliveredCount,
        isActive: r.isActive,
        statusLabel: r.isActive ? 'Live' : 'Sent',
        createdAt: r.createdAt,
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function deactivateCampaign(req, res, next) {
  try {
    const row = await NotificationCampaign.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Campaign not found', 404);
    await row.update({ isActive: false });
    return sendOk(res, { id: row.id, isActive: false }, 'Campaign deactivated');
  } catch (e) {
    next(e);
  }
}
