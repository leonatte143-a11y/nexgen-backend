import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { Booking, Partner, User, GeoZone } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toNum } from '../../serializers/formatters.js';
import { COMMISSION_RATE } from '../../services/money.js';
import { normalizeAdminRole } from '../../constants/rbac.js';

function periodStart(period) {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }
  return start;
}

export async function getAnalytics(req, res, next) {
  try {
    const period = ['day', 'week', 'month', 'year'].includes(req.query.period)
      ? req.query.period
      : 'week';
    const since = periodStart(period);
    const adminRole = normalizeAdminRole(req.adminRole);

    const [bookings, partners, users] = await Promise.all([
      Booking.findAll({ where: { createdAt: { [Op.gte]: since } } }),
      Partner.findAll({ where: { createdAt: { [Op.gte]: since } } }),
      User.findAll({ where: { createdAt: { [Op.gte]: since } } }),
    ]);

    const completed = bookings.filter((b) => ['completed', 'done'].includes(b.userStatus));
    const grossRevenue = completed.reduce((s, b) => s + toNum(b.totalAmount), 0);
    const commission = completed.reduce(
      (s, b) => s + (toNum(b.adminCommission) || Math.round(toNum(b.totalAmount) * COMMISSION_RATE)),
      0,
    );
    const activeBookings = bookings.filter((b) =>
      ['accepted', 'in_progress', 'partner_assigned'].includes(b.partnerStatus),
    ).length;

    const seriesMap = new Map();
    for (const b of bookings) {
      const key = new Date(b.createdAt).toISOString().slice(0, 10);
      if (!seriesMap.has(key)) seriesMap.set(key, { date: key, bookings: 0, revenue: 0, partners: 0 });
      const row = seriesMap.get(key);
      row.bookings += 1;
      if (['completed', 'done'].includes(b.userStatus)) {
        row.revenue += toNum(b.adminCommission) || Math.round(toNum(b.totalAmount) * COMMISSION_RATE);
      }
    }
    for (const p of partners) {
      const key = new Date(p.createdAt).toISOString().slice(0, 10);
      if (!seriesMap.has(key)) seriesMap.set(key, { date: key, bookings: 0, revenue: 0, partners: 0 });
      seriesMap.get(key).partners += 1;
    }

    const series = [...seriesMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    const payload = {
      period,
      totalEarnings: Math.round(commission),
      grossRevenue: Math.round(grossRevenue),
      adminCommission: Math.round(commission),
      activeBookings,
      userGrowth: users.length,
      partnerOnboarding: partners.length,
      series,
    };

    if (adminRole === 'manager') {
      delete payload.totalEarnings;
      delete payload.grossRevenue;
      delete payload.adminCommission;
    }
    if (adminRole === 'hr') {
      delete payload.totalEarnings;
      delete payload.grossRevenue;
      delete payload.adminCommission;
      delete payload.activeBookings;
      payload.series = series.map(({ date, partners: p }) => ({ date, partners: p }));
    }

    return sendOk(res, payload, 'ok');
  } catch (e) {
    next(e);
  }
}

export async function establishServiceZone(req, res, next) {
  try {
    const { city, area, pincode, latitude, longitude, radiusKm = 5 } = req.body;
    if (!city) return sendFail(res, 'city required', 400);

    const id = `gz_${randomUUID().slice(0, 10)}`;
    const zone = await GeoZone.create({
      id,
      name: area ? `${city} — ${area}` : city,
      city,
      polygon: latitude && longitude ? { lat: latitude, lng: longitude, radiusKm } : null,
      surgeFee: 0,
      active: true,
    });

    const { recordAdminAction } = await import('../../utils/auditLog.js');
    await recordAdminAction(req.adminId, 'service_zone_establish', {
      entityType: 'geo_zone',
      entityId: id,
      meta: { city, area, pincode, label: `Established ${city}` },
      req,
    });

    return sendOk(res, { ...zone.toJSON(), pincode, radiusKm, createdBy: req.adminId }, 'Service zone established');
  } catch (e) {
    next(e);
  }
}
