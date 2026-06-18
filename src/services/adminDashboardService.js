import { Op, fn, col, literal } from 'sequelize';
import {
  User,
  Partner,
  Booking,
  SearchLog,
  Service,
} from '../models/index.js';
import { COMMISSION_RATE } from './money.js';
import { toNum } from '../serializers/formatters.js';

const ACTIVE_PARTNER_STATUSES = ['accepted', 'in_progress', 'partner_assigned'];
const LIVE_PARTNER_STATUSES = ['accepted', 'in_progress'];

export async function getDashboardStats() {
  const [totalUsers, totalPartners, onlinePartners, totalBookings, bookingsToday] = await Promise.all([
    User.count(),
    Partner.count(),
    Partner.count({ where: { isOnline: true } }),
    Booking.count(),
    Booking.count({
      where: literal('DATE(created_at) = CURDATE()'),
    }),
  ]);

  const completed = await Booking.findAll({
    where: { userStatus: { [Op.in]: ['completed', 'done'] } },
    attributes: ['adminCommission', 'totalAmount'],
  });
  let totalRevenue = 0;
  let revenueToday = 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  for (const b of completed) {
    const comm = toNum(b.adminCommission) || Math.round(toNum(b.totalAmount) * COMMISSION_RATE);
    totalRevenue += comm;
    if (b.createdAt && new Date(b.createdAt) >= todayStart) revenueToday += comm;
  }

  const liveBookings = await Booking.count({
    where: {
      partnerStatus: { [Op.in]: LIVE_PARTNER_STATUSES },
      userStatus: { [Op.notIn]: ['cancelled', 'completed', 'done'] },
    },
  });

  const unmetRows = await SearchLog.findAll({
    attributes: ['query', [fn('COUNT', col('id')), 'searchCount'], [fn('MAX', col('results_count')), 'lastResults']],
    where: { resultsCount: 0 },
    group: ['query'],
    order: [[literal('searchCount'), 'DESC']],
    limit: 10,
    raw: true,
  });

  return {
    totalUsers,
    activePartners: totalPartners,
    onlinePartners,
    totalBookings,
    bookingsToday,
    totalRevenue: Math.round(totalRevenue),
    revenueToday: Math.round(revenueToday),
    liveBookings,
    commissionRate: COMMISSION_RATE * 100,
    unmetDemand: unmetRows.map((r) => ({
      keyword: r.query,
      searches: Number(r.searchCount),
      partnersFound: Number(r.lastResults) || 0,
    })),
  };
}

export async function getBookingsPerDay(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await Booking.findAll({
    attributes: ['createdAt', 'scheduledAtIso', 'userStatus', 'partnerStatus'],
  });
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, bookings: 0, completed: 0 });
  }
  for (const b of rows) {
    const when = b.createdAt || b.scheduledAtIso;
    if (!when || new Date(when) < since) continue;
    const key = new Date(when).toISOString().slice(0, 10);
    if (!map.has(key)) continue;
    const entry = map.get(key);
    entry.bookings += 1;
    if (['completed', 'done'].includes(b.userStatus)) entry.completed += 1;
  }
  return [...map.values()];
}

export async function getSearchAnalytics() {
  const rows = await SearchLog.findAll({
    attributes: [
      'query',
      'source',
      [fn('COUNT', col('id')), 'searchCount'],
      [fn('AVG', col('results_count')), 'avgResults'],
      [fn('MAX', col('detail_text')), 'sampleDetail'],
    ],
    group: ['query', 'source'],
    order: [[literal('searchCount'), 'DESC']],
    limit: 50,
    raw: true,
  });
  return rows.map((r) => ({
    keyword: r.query,
    searches: Number(r.searchCount),
    avgPartnersFound: Math.round(Number(r.avgResults) || 0),
    unmet: Number(r.avgResults) === 0,
    source: r.source || 'search',
    userCustomRequirements:
      r.source === 'custom_requirement' ? String(r.sampleDetail || r.query) : '',
  }));
}

export async function getRecentActivity(limit = 15) {
  const [bookings, partners] = await Promise.all([
    Booking.findAll({ order: [['createdAt', 'DESC']], limit: 8 }),
    Partner.findAll({ order: [['updatedAt', 'DESC']], limit: 5, attributes: ['id', 'name', 'verificationStatus', 'updatedAt'] }),
  ]);
  const items = [];
  for (const b of bookings) {
    items.push({
      type: 'booking',
      id: b.id,
      title: `${b.serviceName} — ${b.userStatus}`,
      subtitle: b.partnerName,
      at: b.createdAt,
    });
  }
  for (const p of partners) {
    items.push({
      type: 'partner',
      id: p.id,
      title: `Partner ${p.name}`,
      subtitle: p.verificationStatus,
      at: p.updatedAt,
    });
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

export async function getHeatmapData() {
  const searches = await SearchLog.findAll({
    where: { lat: { [Op.ne]: null } },
    attributes: ['lat', 'lng', 'query'],
    limit: 200,
    order: [['createdAt', 'DESC']],
  });
  const online = await Partner.findAll({
    where: { isOnline: true },
    attributes: ['id', 'name', 'primaryCity'],
  });
  return {
    searchPoints: searches.map((s) => ({ lat: toNum(s.lat), lng: toNum(s.lng), weight: 1, label: s.query })),
    partnerOnline: online.map((p) => ({ id: p.id, name: p.name, city: p.primaryCity })),
    mapPlaceholder: true,
  };
}
