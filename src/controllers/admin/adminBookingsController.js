import { Op } from 'sequelize';
import { Booking, User, Partner, Service } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toNum } from '../../serializers/formatters.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { loadLineItemsForBookings } from '../../services/bookingLines.js';

function toAdminBooking(b, user, partner, lineItems = []) {
  return {
    id: b.id,
    serviceName: b.serviceName,
    categoryLabel: b.categoryLabel,
    userStatus: b.userStatus,
    partnerStatus: b.partnerStatus,
    totalAmount: toNum(b.totalAmount),
    itemsSubtotal: b.itemsSubtotal != null ? toNum(b.itemsSubtotal) : null,
    visitingFee: b.visitingFee != null ? toNum(b.visitingFee) : null,
    promoDiscount: b.promoDiscount != null ? toNum(b.promoDiscount) : null,
    adminCommission: toNum(b.adminCommission),
    partnerShare: toNum(b.partnerShare),
    customerName: b.customerName,
    address: b.address,
    partnerId: b.partnerId,
    partnerName: b.partnerName,
    userId: b.userId,
    distanceKm: b.distanceKm != null ? toNum(b.distanceKm) : null,
    createdAt: b.createdAt,
    lineItems,
    user: user
      ? { id: user.id, phone: user.phone, name: [user.firstName, user.lastName].filter(Boolean).join(' ') }
      : null,
    partner: partner ? { id: partner.id, phone: partner.phone, name: partner.name, isOnline: partner.isOnline } : null,
  };
}

export async function listBookings(req, res, next) {
  try {
    const { status, q, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) {
      where[Op.or] = [{ userStatus: status }, { partnerStatus: status }];
    }
    let rows = await Booking.findAll({ where, order: [['createdAt', 'DESC']] });
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(
        (b) =>
          b.serviceName?.toLowerCase().includes(s) ||
          b.customerName?.toLowerCase().includes(s) ||
          b.id.includes(s),
      );
    }
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const slice = rows.slice((p - 1) * l, p * l);
    const users = await User.findAll({ where: { id: slice.map((b) => b.userId) } });
    const partners = await Partner.findAll({ where: { id: slice.map((b) => b.partnerId) } });
    const uMap = new Map(users.map((u) => [u.id, u]));
    const pMap = new Map(partners.map((x) => [x.id, x]));
    const lineMap = await loadLineItemsForBookings(slice.map((b) => b.id));
    return sendOk(res, {
      items: slice.map((b) =>
        toAdminBooking(b, uMap.get(b.userId), pMap.get(b.partnerId), lineMap.get(b.id) || []),
      ),
      total: rows.length,
      page: p,
      limit: l,
    });
  } catch (e) {
    next(e);
  }
}

export async function getBookingDetail(req, res, next) {
  try {
    const b = await Booking.findByPk(req.params.id);
    if (!b) return sendFail(res, 'Booking not found', 404);
    const user = await User.findByPk(b.userId);
    const partner = await Partner.findByPk(b.partnerId);
    const lineMap = await loadLineItemsForBookings([b.id]);
    return sendOk(res, toAdminBooking(b, user, partner, lineMap.get(b.id) || []));
  } catch (e) {
    next(e);
  }
}

export async function liveBookings(_req, res, next) {
  try {
    const rows = await Booking.findAll({
      where: {
        partnerStatus: { [Op.in]: ['accepted', 'in_progress', 'new'] },
        userStatus: { [Op.notIn]: ['cancelled', 'completed', 'done'] },
      },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    const partners = await Partner.findAll({
      where: { id: rows.map((b) => b.partnerId) },
      attributes: ['id', 'name', 'isOnline', 'primaryCity'],
    });
    const pMap = new Map(partners.map((x) => [x.id, x]));
    return sendOk(
      res,
      rows.map((b) => ({
        ...toAdminBooking(b, null, pMap.get(b.partnerId)),
        live: true,
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function assignPartner(req, res, next) {
  try {
    const { partnerId } = req.body;
    if (!partnerId) return sendFail(res, 'partnerId required', 400);
    const b = await Booking.findByPk(req.params.id);
    if (!b) return sendFail(res, 'Booking not found', 404);
    const partner = await Partner.findByPk(partnerId);
    if (!partner) return sendFail(res, 'Partner not found', 404);
    await b.update({
      partnerId: partner.id,
      partnerName: partner.name,
      partnerRating: partner.rating,
      partnerStatus: 'new',
      userStatus: 'partner_assigned',
    });
    await recordAdminAction(req.adminId, 'booking_assign', {
      entityType: 'booking',
      entityId: b.id,
      meta: { partnerId },
      req,
    });
    return sendOk(res, toAdminBooking(b, null, partner), 'Partner assigned');
  } catch (e) {
    next(e);
  }
}

export async function reassignPartner(req, res, next) {
  try {
    const { newPartnerId, reason } = req.body;
    if (!newPartnerId) return sendFail(res, 'newPartnerId required', 400);
    const b = await Booking.findByPk(req.params.bookingId || req.params.id);
    if (!b) return sendFail(res, 'Booking not found', 404);
    const partner = await Partner.findByPk(newPartnerId);
    if (!partner) return sendFail(res, 'Partner not found', 404);
    if (!partner.isOnline) return sendFail(res, 'Partner must be online', 400);
    const oldPartnerId = b.partnerId;
    await b.update({
      partnerId: partner.id,
      partnerName: partner.name,
      partnerRating: partner.rating,
      partnerStatus: 'new',
      userStatus: 'partner_assigned',
    });
    await recordAdminAction(req.adminId, 'booking_reassign', {
      entityType: 'booking',
      entityId: b.id,
      meta: { oldPartnerId, newPartnerId, reason: reason || 'Partner not moving' },
      req,
    });
    return sendOk(res, toAdminBooking(b, null, partner), 'Booking reassigned');
  } catch (e) {
    next(e);
  }
}

export async function onlinePartnersForReassign(_req, res, next) {
  try {
    const rows = await Partner.findAll({
      where: { isOnline: true, isBlocked: false, isFrozen: false, archivedAt: null },
      attributes: ['id', 'name', 'phone', 'rating', 'primaryCity', 'isOnline'],
      order: [['rating', 'DESC']],
      limit: 50,
    });
    return sendOk(res, rows, 'ok');
  } catch (e) {
    next(e);
  }
}
