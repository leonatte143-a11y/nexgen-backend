import { randomInt } from 'crypto';
import { User, Service, Partner, Booking, Review } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toUserBooking } from '../serializers/mappers.js';
import {
  computeBill,
  CANCELLATION_FEE_USER,
  DEFAULT_VISITING_FEE,
} from '../services/money.js';
import { quoteVisitingCharge, resolveCityCentroid } from '../services/visitingChargeService.js';
import {
  normalizeSelectedItems,
  sumLineItems,
  createBookingLineItems,
  loadLineItemsForBookings,
} from '../services/bookingLines.js';
import { ctrlLog } from '../utils/devLogger.js';

function genOtp() {
  return String(randomInt(1000, 10000));
}

function cityFromAddress(address, partner) {
  const text = `${address || ''} ${partner?.primaryCity || ''}`.toLowerCase();
  if (text.includes('guntur')) return 'Guntur';
  if (text.includes('rajahmundry') || text.includes('rajamahendravaram')) return 'Rajahmundry';
  return partner?.primaryCity || 'Rajahmundry';
}

async function bookingWithLineItems(booking) {
  const map = await loadLineItemsForBookings([booking.id]);
  const partner = await Partner.findByPk(booking.partnerId);
  const payload = toUserBooking(booking, map.get(booking.id) || []);
  if (partner?.phone) payload.partnerPhone = partner.phone;
  return payload;
}

export async function quoteVisitingChargeHandler(req, res, next) {
  try {
    const { userLat, userLng, partnerLat, partnerLng, city, partnerId } = req.body;
    let pLat = partnerLat;
    let pLng = partnerLng;
    if (partnerId) {
      const partner = await Partner.findByPk(String(partnerId));
      if (partner?.latitude != null && partner?.longitude != null) {
        pLat = partner.latitude;
        pLng = partner.longitude;
      } else if (partner) {
        const c = resolveCityCentroid(partner.primaryCity);
        pLat = c.lat;
        pLng = c.lng;
      }
    }
    const user = await User.findByPk(req.userId);
    let uLat = userLat ?? user?.latitude;
    let uLng = userLng ?? user?.longitude;
    const quote = await quoteVisitingCharge({
      userLat: uLat,
      userLng: uLng,
      partnerLat: pLat,
      partnerLng: pLng,
      city: city || user?.address,
      partnerId,
    });
    return sendOk(res, quote);
  } catch (e) {
    next(e);
  }
}

export async function listMyBookings(req, res, next) {
  try {
    const rows = await Booking.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
    });
    const map = await loadLineItemsForBookings(rows.map((b) => b.id));
    return sendOk(res, rows.map((b) => toUserBooking(b, map.get(b.id) || [])));
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
    return sendOk(res, await bookingWithLineItems(b));
  } catch (e) {
    next(e);
  }
}

export async function createBooking(req, res, next) {
  try {
    const {
      serviceId,
      partnerId: bodyPartnerId,
      address,
      notes = '',
      paymentMethod = 'cod',
      promoCode,
      amountOverride,
      serviceNameOverride,
      distanceKm: bodyDistanceKm,
      visitingCharges: bodyVisitingCharges,
      selectedItems,
      userLat,
      userLng,
    } = req.body;
    if (!address) return sendFail(res, 'Address required', 400);
    if (!serviceId) return sendFail(res, 'serviceId required', 400);

    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const service = await Service.findByPk(serviceId, { include: [{ model: Partner, as: 'partner' }] });
    if (!service) return sendFail(res, 'Service not found', 404);

    let partner = service.partner;
    if (bodyPartnerId) {
      const selected = await Partner.findByPk(String(bodyPartnerId));
      if (!selected) return sendFail(res, 'Partner not found', 404);
      partner = selected;
    }
    if (!partner) return sendFail(res, 'Partner not linked to service', 400);

    const city = cityFromAddress(address, partner);
    const quote =
      bodyDistanceKm != null && bodyVisitingCharges != null
        ? {
            distanceKm: Math.max(0, Number(bodyDistanceKm)),
            visitingCharges: Number(bodyVisitingCharges),
          }
        : await quoteVisitingCharge({
            userLat: userLat ?? user.latitude,
            userLng: userLng ?? user.longitude,
            partnerLat: partner.latitude,
            partnerLng: partner.longitude,
            city,
            partnerId: partner.id,
          });

    const lineItems = normalizeSelectedItems(selectedItems);
    let itemsSubtotal = lineItems.length ? sumLineItems(lineItems) : 0;
    if (!lineItems.length) {
      itemsSubtotal =
        amountOverride != null ? Number(amountOverride) : parseFloat(String(service.basePrice));
    }

    const visitingFee = quote.visitingCharges ?? DEFAULT_VISITING_FEE;
    const bill = computeBill(itemsSubtotal, visitingFee);
    let promoDiscount = 0;
    let totalAmount = bill.total;
    if (String(promoCode || '').toUpperCase() === 'NEXGEN2026') {
      promoDiscount = 50;
      totalAmount = Math.max(0, totalAmount - promoDiscount);
    }

    if (amountOverride != null) {
      const expected = totalAmount;
      const got = Math.round(Number(amountOverride));
      const withGst =
        itemsSubtotal +
        visitingFee +
        Math.round((itemsSubtotal + visitingFee) * 0.18) -
        (String(promoCode || '').toUpperCase() === 'NEXGEN2026' ? 50 : 0);
      const tolerance = Math.max(2, Math.round(withGst * 0.02));
      if (Math.abs(got - expected) > tolerance && Math.abs(got - withGst) > tolerance) {
        return sendFail(res, 'Booking total mismatch. Please refresh and try again.', 400);
      }
    }

    const subtotal = itemsSubtotal + bill.visitingFee;
    const partnerShare = Math.round((subtotal - bill.adminComm) * 100) / 100;

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || `Customer ${user.phone.slice(-4)}`;
    const scheduled = new Date().toISOString();

    const serviceLabel =
      serviceNameOverride ||
      (lineItems.length > 1
        ? `${service.name} (${lineItems.length} items)`
        : lineItems.length === 1
          ? lineItems[0].title
          : service.name);

    const b = await Booking.create({
      id: `bk_${Date.now()}_${randomInt(100, 1000)}`,
      userId: user.id,
      serviceId: service.id,
      partnerId: partner.id,
      userStatus: 'partner_assigned',
      partnerStatus: 'new',
      serviceName: serviceLabel,
      categoryLabel: service.categoryLabel,
      partnerName: partner.name,
      partnerRating: partner.rating,
      customerName: name,
      address,
      notes: String(notes).slice(0, 2000),
      totalAmount,
      itemsSubtotal,
      promoDiscount,
      visitingFee: bill.visitingFee,
      adminCommission: bill.adminComm,
      partnerShare,
      startOtp: genOtp(),
      endOtp: genOtp(),
      scheduledAt: scheduled,
      scheduledAtIso: new Date(),
      etaMins: 12,
      paymentMethod,
      promoCode: promoCode || null,
      amountOverride: amountOverride != null ? Number(amountOverride) : null,
      serviceNameOverride: serviceNameOverride || null,
      distanceKm: quote.distanceKm,
      requestedAtLabel: 'Just now',
    });

    if (lineItems.length) {
      await createBookingLineItems(b.id, lineItems);
    }

    if (userLat != null && userLng != null) {
      await user.update({ latitude: userLat, longitude: userLng }).catch(() => {});
    }

    ctrlLog('BOOKING', 'Booking created', req, {
      bookingId: b.id,
      serviceId,
      totalAmount,
      lineItemCount: lineItems.length,
    });
    return sendOk(res, await bookingWithLineItems(b), 'Booking created');
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
