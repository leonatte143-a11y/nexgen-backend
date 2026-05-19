import { randomInt } from 'crypto';
import { User, Service, Partner, Booking, Review } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toUserBooking } from '../serializers/mappers.js';
import { computeBill, CANCELLATION_FEE_USER, DEFAULT_VISITING_FEE } from '../services/money.js';
import { ctrlLog } from '../utils/devLogger.js';

function genOtp() {
  return String(randomInt(1000, 10000));
}

export async function listMyBookings(req, res, next) {
  try {
    const rows = await Booking.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
    });
    return sendOk(res, rows.map(toUserBooking));
  } catch (e) {
    next(e);
  }
}

export async function getBooking(req, res, next) {
  try {
    const b = await Booking.findOne({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!b) return sendFail(res, 'Booking not found', 404);
    return sendOk(res, toUserBooking(b));
  } catch (e) {
    next(e);
  }
}

export async function createBooking(req, res, next) {
  try {
    const {
      serviceId,
      address,
      notes = '',
      paymentMethod = 'cod',
      promoCode,
      amountOverride,
      serviceNameOverride,
    } = req.body;
    if (!address) return sendFail(res, 'Address required', 400);
    if (!serviceId) return sendFail(res, 'serviceId required', 400);

    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const service = await Service.findByPk(serviceId, { include: [{ model: Partner, as: 'partner' }] });
    if (!service) return sendFail(res, 'Service not found', 404);
    const partner = service.partner;
    if (!partner) return sendFail(res, 'Partner not linked to service', 400);

    const base = amountOverride != null ? Number(amountOverride) : parseFloat(String(service.basePrice));
    const bill = computeBill(base, DEFAULT_VISITING_FEE);
    let totalAmount = bill.total;
    if (String(promoCode || '').toUpperCase() === 'NEXGEN2026') {
      totalAmount = Math.max(0, totalAmount - 50);
    }
    const subtotal = base + bill.visitingFee;
    const partnerShare = Math.round((subtotal - bill.adminComm) * 100) / 100;

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || `Customer ${user.phone.slice(-4)}`;
    const scheduled = new Date().toISOString();

    const b = await Booking.create({
      id: `bk_${Date.now()}_${randomInt(100, 1000)}`,
      userId: user.id,
      serviceId: service.id,
      partnerId: partner.id,
      userStatus: 'partner_assigned',
      partnerStatus: 'new',
      serviceName: serviceNameOverride || service.name,
      categoryLabel: service.categoryLabel,
      partnerName: partner.name,
      partnerRating: partner.rating,
      customerName: name,
      address,
      notes: String(notes).slice(0, 2000),
      totalAmount,
      visitingFee: bill.visitingFee,
      adminCommission: bill.adminComm,
      partnerShare,
      startOtp: genOtp(),
      scheduledAt: scheduled,
      scheduledAtIso: new Date(),
      etaMins: 12,
      paymentMethod,
      promoCode: promoCode || null,
      amountOverride: amountOverride != null ? Number(amountOverride) : null,
      serviceNameOverride: serviceNameOverride || null,
      distanceKm: service.distanceKm,
      requestedAtLabel: 'Just now',
    });

    ctrlLog('BOOKING', 'Booking created', req, { bookingId: b.id, serviceId, totalAmount });
    return sendOk(res, toUserBooking(b), 'Booking created');
  } catch (e) {
    next(e);
  }
}

export async function cancelBooking(req, res, next) {
  try {
    const b = await Booking.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!b) return sendFail(res, 'Booking not found', 404);
    const fee = CANCELLATION_FEE_USER;
    const refund = Math.max(0, parseFloat(String(b.totalAmount)) - fee);
    b.userStatus = 'cancelled';
    b.partnerStatus = 'cancelled';
    await b.save();
    return sendOk(res, { refund, fee });
  } catch (e) {
    next(e);
  }
}

export async function submitReview(req, res, next) {
  try {
    const { stars, tags = [], note = '' } = req.body;
    const b = await Booking.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!b) return sendFail(res, 'Booking not found', 404);
    if (b.userStatus !== 'completed') {
      return sendFail(res, 'Only completed bookings can be reviewed', 400);
    }
    const existing = await Review.findOne({ where: { bookingId: b.id } });
    if (existing) {
      return sendOk(res, {
        bookingId: b.id,
        stars: existing.stars,
        tags: existing.tags,
        note: existing.note,
        pointsEarned: existing.pointsEarned,
      });
    }
    const s = Math.min(5, Math.max(1, parseInt(String(stars), 10) || 5));
    const rev = await Review.create({
      id: `rev_${b.id}`,
      bookingId: b.id,
      userId: req.userId,
      serviceId: b.serviceId,
      partnerId: b.partnerId,
      stars: s,
      tags: Array.isArray(tags) ? tags : [],
      note: String(note).slice(0, 2000),
      pointsEarned: 10,
    });
    const user = await User.findByPk(req.userId);
    if (user) await user.update({ rewardPoints: (user.rewardPoints || 0) + 10 });
    return sendOk(res, { bookingId: b.id, stars: rev.stars, tags: rev.tags, note: rev.note, pointsEarned: 10 });
  } catch (e) {
    next(e);
  }
}
