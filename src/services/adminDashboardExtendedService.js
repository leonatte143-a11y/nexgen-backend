import { randomUUID } from 'crypto';
import { Op, fn, col, literal } from 'sequelize';
import {
  User,
  Partner,
  Booking,
  Review,
  SupportTicket,
  PayoutQueue,
  Settlement,
  AdvertisementBanner,
  RevenueTransaction,
  SupportConversation,
  SupportMessage,
} from '../models/index.js';
import { COMMISSION_RATE } from './money.js';
import { toNum } from '../serializers/formatters.js';
import { getDashboardStats } from './adminDashboardService.js';

const PARTNER_REG_FEE = Number(process.env.PARTNER_REGISTRATION_FEE) || 299;
const AD_REVENUE_PER_BANNER = Number(process.env.AD_REVENUE_PER_BANNER_MONTHLY) || 2500;
const USER_SUBSCRIPTION_MONTHLY = Number(process.env.USER_SUBSCRIPTION_MONTHLY) || 99;

function mapPartnerRow(p) {
  return {
    id: p.id,
    name: p.name || 'Partner',
    rating: toNum(p.rating),
    completedJobs: p.completedJobsCount ?? p.jobsCompleted ?? 0,
    status: p.verificationStatus || 'Pending',
    earnings: toNum(p.lifetimeEarnings) || toNum(p.walletBalance),
    walletBalance: toNum(p.walletBalance),
    isOnline: Boolean(p.isOnline),
  };
}

function sentimentFromRating(rating) {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

export async function getPartnerPerformance() {
  const partners = await Partner.findAll();
  const mapped = partners.map(mapPartnerRow);
  const topByJobs = [...mapped]
    .sort((a, b) => b.completedJobs - a.completedJobs)
    .slice(0, 3);
  const topByRating = [...mapped]
    .sort((a, b) => b.rating - a.rating || b.completedJobs - a.completedJobs)
    .slice(0, 3);
  return { topByJobs, topByRating, totalPartners: partners.length };
}

async function sumRevenueByCategory(category) {
  try {
    const rows = await RevenueTransaction.findAll({
      where: { category, status: { [Op.in]: ['completed', 'pending'] } },
      // Physical column names (underscored: true) — col('grossAmount') breaks MySQL
      attributes: [[fn('SUM', col('gross_amount')), 'total']],
      raw: true,
    });
    return Math.round(toNum(rows[0]?.total));
  } catch {
    return 0;
  }
}

async function ensureRevenueBackfill() {
  let count = 0;
  try {
    count = await RevenueTransaction.count();
  } catch {
    return;
  }
  if (count > 0) return;

  const completed = await Booking.findAll({
    where: { userStatus: { [Op.in]: ['completed', 'done'] } },
  });
  for (const b of completed) {
    const comm = toNum(b.adminCommission) || Math.round(toNum(b.totalAmount) * COMMISSION_RATE);
    if (comm <= 0) continue;
    await RevenueTransaction.create({
      id: `rev_${randomUUID().slice(0, 12)}`,
      sourceType: 'booking',
      sourceId: b.id,
      category: 'booking_commission',
      grossAmount: comm,
      commissionAmount: comm,
      netAmount: comm,
      status: 'completed',
      city: null,
    }).catch(() => {});
  }

  const partners = await Partner.findAll();
  for (const p of partners) {
    await RevenueTransaction.create({
      id: `rev_${randomUUID().slice(0, 12)}`,
      sourceType: 'partner',
      sourceId: p.id,
      category: 'partner_registration',
      grossAmount: PARTNER_REG_FEE,
      commissionAmount: PARTNER_REG_FEE,
      netAmount: PARTNER_REG_FEE,
      status: 'completed',
      city: p.primaryCity,
    }).catch(() => {});
  }

  const banners = await AdvertisementBanner.findAll({ where: { isActive: true } });
  for (const banner of banners) {
    await RevenueTransaction.create({
      id: `rev_${randomUUID().slice(0, 12)}`,
      sourceType: 'banner',
      sourceId: banner.id,
      category: 'advertising',
      grossAmount: AD_REVENUE_PER_BANNER,
      commissionAmount: AD_REVENUE_PER_BANNER,
      netAmount: AD_REVENUE_PER_BANNER,
      status: 'completed',
      city: banner.city,
    }).catch(() => {});
  }

  const users = await User.findAll({ limit: 500 });
  for (const u of users.slice(0, Math.min(users.length, 50))) {
    await RevenueTransaction.create({
      id: `rev_${randomUUID().slice(0, 12)}`,
      sourceType: 'user',
      sourceId: u.id,
      category: 'user_subscription',
      grossAmount: USER_SUBSCRIPTION_MONTHLY,
      commissionAmount: USER_SUBSCRIPTION_MONTHLY,
      netAmount: USER_SUBSCRIPTION_MONTHLY,
      status: 'completed',
    }).catch(() => {});
  }
}

export async function getFinancialBreakdown() {
  try {
    await ensureRevenueBackfill();
  } catch {
    /* table may not exist yet — fall back to derived totals below */
  }

  let bookingCommission = await sumRevenueByCategory('booking_commission');
  let partnerRegistration = await sumRevenueByCategory('partner_registration');
  let advertising = await sumRevenueByCategory('advertising');
  let userSubscription = await sumRevenueByCategory('user_subscription');

  if (bookingCommission === 0) {
    const completed = await Booking.findAll({
      where: { userStatus: { [Op.in]: ['completed', 'done'] } },
    });
    bookingCommission = completed.reduce(
      (s, b) => s + (toNum(b.adminCommission) || Math.round(toNum(b.totalAmount) * COMMISSION_RATE)),
      0,
    );
  }
  if (partnerRegistration === 0) {
    const pc = await Partner.count();
    partnerRegistration = pc * PARTNER_REG_FEE;
  }
  if (advertising === 0) {
    const bc = await AdvertisementBanner.count({ where: { isActive: true } });
    advertising = bc * AD_REVENUE_PER_BANNER;
  }
  if (userSubscription === 0) {
    const uc = await User.count();
    userSubscription = Math.round(uc * USER_SUBSCRIPTION_MONTHLY * 0.15);
  }

  const categories = [
    { id: 'user_subscription', label: 'User Subscriptions', amount: userSubscription },
    { id: 'partner_registration', label: 'Service Partner Registrations', amount: partnerRegistration },
    { id: 'booking_commission', label: 'Booking Commission', amount: bookingCommission },
    { id: 'advertising', label: 'Advertisement Revenue', amount: advertising },
  ];
  const totalRevenue = categories.reduce((s, c) => s + c.amount, 0);

  const stats = await getDashboardStats();
  return {
    totalRevenue,
    revenueToday: stats.revenueToday,
    totalCommissionEarned: bookingCommission,
    categories,
  };
}

export async function getFinancialPipeline() {
  const queued = await PayoutQueue.findAll({ where: { status: 'queued' } });
  const pendingPayouts = queued.reduce((s, r) => s + toNum(r.amount), 0);

  const pendingSettlements = await Settlement.findAll({ where: { status: 'pending' } });
  const settlementPending = pendingSettlements.reduce((s, r) => s + toNum(r.amount), 0);

  const partners = await Partner.findAll();
  const partnerWalletTotal = partners.reduce((s, p) => s + toNum(p.walletBalance), 0);

  const escrowBookings = await Booking.findAll({
    where: {
      userStatus: { [Op.in]: ['completed', 'done'] },
      partnerStatus: { [Op.notIn]: ['cancelled'] },
    },
  });
  const completedUnpaidBookingTotal = escrowBookings.reduce((s, b) => {
    const unpaid = toNum(b.partnerShare) || toNum(b.totalAmount) * (1 - COMMISSION_RATE);
    return s + unpaid;
  }, 0);

  const escrowBalance = Math.round(partnerWalletTotal + settlementPending);

  return {
    pendingPayouts: Math.round(pendingPayouts),
    escrowBalance,
    partnerWalletTotal: Math.round(partnerWalletTotal),
    payoutQueueCount: queued.length,
    completedUnpaidBookingTotal: Math.round(completedUnpaidBookingTotal),
    settlementPending: Math.round(settlementPending),
  };
}

function parseRangeDays(range = '7d') {
  const m = String(range).match(/^(\d+)d$/);
  return m ? Math.min(90, Math.max(1, parseInt(m[1], 10))) : 7;
}

export async function getUserGrowth(range = '7d') {
  const days = parseRangeDays(range);
  const totalUsers = await User.count();

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);
  const prevStart = new Date(periodStart);
  prevStart.setDate(prevStart.getDate() - days);

  const users = await User.findAll({ attributes: ['id', 'createdAt'] });

  let currentPeriodUsers = 0;
  let previousPeriodUsers = 0;
  const sparkMap = new Map();

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    sparkMap.set(d.toISOString().slice(0, 10), 0);
  }

  for (const u of users) {
    const created = u.createdAt ? new Date(u.createdAt) : null;
    if (!created) continue;
    const key = created.toISOString().slice(0, 10);
    if (sparkMap.has(key)) sparkMap.set(key, sparkMap.get(key) + 1);
    if (created >= periodStart) currentPeriodUsers += 1;
    else if (created >= prevStart && created < periodStart) previousPeriodUsers += 1;
  }

  const growthPercent =
    previousPeriodUsers > 0
      ? Math.round(((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 1000) / 10
      : currentPeriodUsers > 0
        ? 100
        : 0;

  const sparkline = [...sparkMap.entries()].map(([date, count]) => ({ date, count }));

  const monthlyDays = 30;
  const monthStart = new Date(now);
  monthStart.setDate(monthStart.getDate() - monthlyDays);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setDate(prevMonthStart.getDate() - monthlyDays);
  let currentMonth = 0;
  let prevMonth = 0;
  for (const u of users) {
    const created = u.createdAt ? new Date(u.createdAt) : null;
    if (!created) continue;
    if (created >= monthStart) currentMonth += 1;
    else if (created >= prevMonthStart && created < monthStart) prevMonth += 1;
  }
  const monthlyGrowthPct =
    prevMonth > 0 ? Math.round(((currentMonth - prevMonth) / prevMonth) * 1000) / 10 : currentMonth > 0 ? 100 : 0;

  return {
    totalUsers,
    currentPeriodUsers,
    previousPeriodUsers,
    growthPercent,
    weeklyGrowthPct: growthPercent,
    monthlyGrowthPct,
    sparkline,
  };
}

export async function getReviewsSentiment(limit = 10) {
  const reviews = await Review.findAll({
    order: [['createdAt', 'DESC']],
    limit: Math.min(50, limit),
  });

  const partnerIds = [...new Set(reviews.map((r) => r.partnerId))];
  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const [partners, users] = await Promise.all([
    Partner.findAll({ where: { id: partnerIds } }),
    User.findAll({ where: { id: userIds } }),
  ]);
  const partnerMap = new Map(partners.map((p) => [p.id, p.name]));
  const userMap = new Map(
    users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.phone || 'Customer']),
  );

  const mapped = reviews.map((r) => {
    const rating = r.stars ?? 0;
    return {
      id: r.id,
      customerName: userMap.get(r.userId) || 'Customer',
      partnerName: partnerMap.get(r.partnerId) || 'Partner',
      rating,
      comment: r.note || '',
      createdAt: r.createdAt,
      sentiment: sentimentFromRating(rating),
    };
  });

  const avg =
    mapped.length > 0 ? mapped.reduce((s, r) => s + r.rating, 0) / mapped.length : 0;
  const negativeReviewCount = mapped.filter((r) => r.rating < 3).length;

  return {
    averageRating: Math.round(avg * 10) / 10,
    negativeReviewCount,
    reviews: mapped,
  };
}

async function syncConversationsFromTickets() {
  const convCount = await SupportConversation.count();
  if (convCount > 0) return;

  const tickets = await SupportTicket.findAll({ order: [['updatedAt', 'DESC']], limit: 50 });
  for (const t of tickets) {
    const transcript = Array.isArray(t.chatTranscript) ? t.chatTranscript : [];
    const last = transcript[transcript.length - 1];
    const lastMsg = last?.text || last?.message || t.description || t.subject;
    const convId = `conv_${t.id}`;
    await SupportConversation.create({
      id: convId,
      userId: t.userId,
      partnerId: t.partnerId,
      bookingId: t.bookingId,
      ticketId: t.id,
      channel: t.partnerId ? 'partner' : 'customer',
      status: t.status === 'closed' ? 'resolved' : 'open',
      lastMessage: String(lastMsg || '').slice(0, 500),
      lastMessageAt: t.updatedAt || t.createdAt,
      unreadCount: t.status === 'open' ? 1 : 0,
    }).catch(() => {});
  }
}

export async function getSupportChatSummary() {
  await syncConversationsFromTickets();

  const conversations = await SupportConversation.findAll({
    order: [['lastMessageAt', 'DESC']],
    limit: 30,
  });

  const partnerIds = conversations.map((c) => c.partnerId).filter(Boolean);
  const userIds = conversations.map((c) => c.userId).filter(Boolean);
  const [partners, users] = await Promise.all([
    Partner.findAll({ where: { id: { [Op.in]: partnerIds.length ? partnerIds : ['__none__'] } } }),
    User.findAll({ where: { id: { [Op.in]: userIds.length ? userIds : ['__none__'] } } }),
  ]);
  const partnerOnline = new Map(partners.map((p) => [p.id, p.isOnline]));

  const mapConv = (c) => {
    const isPartner = Boolean(c.partnerId);
    const name = isPartner
      ? partners.find((p) => p.id === c.partnerId)?.name
      : users.find((u) => u.id === c.userId)?.firstName;
    return {
      id: c.id,
      participantName: `${name || (isPartner ? 'Partner' : 'Customer')} (${isPartner ? 'Partner' : 'Customer'})`,
      participantType: c.channel === 'internal' ? 'admin' : isPartner ? 'partner' : 'customer',
      lastMessage: c.lastMessage || '',
      unreadCount: c.unreadCount || 0,
      isOnline: isPartner ? Boolean(partnerOnline.get(c.partnerId)) : false,
      updatedAt: c.lastMessageAt || c.updatedAt,
    };
  };

  const active = conversations.filter((c) => c.status === 'open' || c.status === 'active');
  const activeChats = active
    .filter((c) => c.channel !== 'internal')
    .slice(0, 8)
    .map(mapConv);
  const internalThreads = conversations
    .filter((c) => c.channel === 'internal')
    .slice(0, 6)
    .map(mapConv);

  if (internalThreads.length === 0 && activeChats.length > 0) {
    internalThreads.push({
      id: 'internal_ops',
      participantName: 'Ops — Support queue',
      participantType: 'admin',
      lastMessage: `${active.length} active conversations`,
      unreadCount: active.reduce((s, c) => s + (c.unreadCount || 0), 0),
      isOnline: true,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    provider: 'placeholder',
    activeConversationsCount: active.length,
    unresolvedConversationsCount: active.filter((c) => c.status === 'open').length,
    activeChats,
    internalThreads,
  };
}

export async function getDashboardAlerts() {
  const pendingKyc = await Partner.count({
    where: { verificationStatus: { [Op.in]: ['Pending', 'pending', 'Rejected'] } },
  });

  const openTicketsCount = await SupportTicket.count({
    where: { status: { [Op.in]: ['open', 'pending', 'in_progress'] } },
  });

  const pendingPayoutRequestsCount = await PayoutQueue.count({ where: { status: 'queued' } });

  const reviews = await Review.findAll({ attributes: ['stars'] });
  const negativeReviewsCount = reviews.filter((r) => (r.stars ?? 0) < 3).length;

  const activeDisputesCount = await SupportTicket.count({
    where: {
      status: { [Op.in]: ['open', 'pending', 'in_progress'] },
      priority: { [Op.in]: ['high', 'urgent'] },
    },
  });

  const failedBookingsCount = await Booking.count({
    where: {
      [Op.or]: [
        { userStatus: { [Op.in]: ['failed', 'stuck', 'cancelled'] } },
        { partnerStatus: { [Op.in]: ['failed', 'declined', 'cancelled'] } },
      ],
    },
  });

  return {
    pendingKycCount: pendingKyc,
    openTicketsCount,
    pendingPayoutRequestsCount,
    negativeReviewsCount,
    activeDisputesCount: activeDisputesCount || openTicketsCount,
    failedBookingsCount,
  };
}
