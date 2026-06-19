import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { Notification, User, NotificationCampaign, Partner, Shop } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';

async function resolveAudienceUserIds(audience) {
  const aud = String(audience || 'all_users');
  if (aud === 'all_users') {
    return User.findAll({ attributes: ['id'] });
  }
  if (aud === 'partners') {
    const partners = await Partner.findAll({
      attributes: ['phone'],
      where: { archivedAt: null },
    });
    const phones = new Set(partners.map((p) => String(p.phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean));
    const users = await User.findAll({ attributes: ['id', 'phone'] });
    return users.filter((u) => phones.has(String(u.phone || '').replace(/\D/g, '').slice(-10)));
  }
  if (aud === 'shops') {
    const shops = await Shop.findAll({ attributes: ['phone'], where: { isActive: true } });
    const phones = new Set(shops.map((s) => String(s.phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean));
    const users = await User.findAll({ attributes: ['id', 'phone'] });
    return users.filter((u) => phones.has(String(u.phone || '').replace(/\D/g, '').slice(-10)));
  }
  return User.findAll({ attributes: ['id'] });
}

export async function broadcast(req, res, next) {
  try {
    const {
      title,
      body,
      city,
      type = 'offer',
      audience = 'all_users',
      expiresAt,
    } = req.body;
    if (!title || !body) return sendFail(res, 'title and body required', 400);

    const recipients = await resolveAudienceUserIds(audience);
    const expiry = expiresAt ? new Date(expiresAt) : null;
    const messageBody = city ? `${body} (${city})` : body;
    let count = 0;

    for (const u of recipients.slice(0, 500)) {
      await Notification.create({
        id: `n_${randomUUID().slice(0, 10)}`,
        userId: u.id,
        type,
        title,
        body: messageBody,
        read: false,
        timeLabel: 'now',
        expiresAt: expiry,
        audience: String(audience),
      });
      count += 1;
    }

    const isLiveType = ['alert', 'order', 'health', 'live'].includes(String(type).toLowerCase());
    const now = new Date();
    const campaignActive = isLiveType && (!expiry || expiry > now);

    await NotificationCampaign.create({
      id: `nc_${randomUUID().slice(0, 10)}`,
      title,
      body: messageBody,
      type: isLiveType ? 'live' : 'offer',
      city: city || null,
      audience: String(audience),
      expiresAt: expiry,
      totalSent: count,
      deliveredCount: count,
      isActive: campaignActive,
      createdBy: req.adminId || null,
    });

    await recordAdminAction(req.adminId, 'notification_broadcast', { meta: { count, city, audience }, req });
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
    const now = new Date();
    const rows = await NotificationCampaign.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return sendOk(
      res,
      rows.map((r) => {
        const expired = r.expiresAt && new Date(r.expiresAt) < now;
        const live = r.isActive && !expired;
        return {
          id: r.id,
          title: r.title,
          body: r.body,
          type: r.type,
          audience: r.audience,
          city: r.city,
          totalSent: r.totalSent,
          delivered: r.deliveredCount,
          isActive: live,
          statusLabel: live ? 'Live' : expired ? 'Expired' : 'Sent',
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
        };
      }),
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
