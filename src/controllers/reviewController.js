import { randomInt } from 'crypto';
import { Review, User } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { timeAgoLabel } from '../serializers/formatters.js';

/**
 * Partner reviews for social proof.
 * Note: Booking reviews still use `/bookings/:id/review`.
 */
export async function listPartnerReviews(req, res, next) {
  try {
    const partnerId = req.params.id;
    const rows = await Review.findAll({
      where: { partnerId },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    return sendOk(
      res,
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        partnerId: r.partnerId,
        rating: r.stars,
        comment: r.note || '',
        createdAt: r.createdAt,
      })),
    );
  } catch (e) {
    next(e);
  }
}

/**
 * GET /partners/reviews/mine (requirePartner) — the logged-in partner's own reviews for the
 * "Social proof and performance" dashboard section. Reviewer identity is reduced to a
 * privacy-conscious display name (first name + last-initial) rather than the full name.
 */
export async function listMyReviews(req, res, next) {
  try {
    const rows = await Review.findAll({
      where: { partnerId: req.partnerId },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = userIds.length ? await User.findAll({ where: { id: userIds } }) : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    return sendOk(
      res,
      rows.map((r) => {
        const u = userById.get(r.userId);
        const first = u?.firstName?.trim();
        const lastInitial = u?.lastName?.trim()?.[0];
        const displayName = first ? `${first}${lastInitial ? ` ${lastInitial}.` : ''}` : 'Customer';
        return {
          id: r.id,
          customerName: displayName,
          rating: r.stars,
          comment: r.note || '',
          timeLabel: timeAgoLabel(r.createdAt),
        };
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function createReview(req, res, next) {
  try {
    const { partnerId, rating, comment = '' } = req.body || {};
    const pid = String(partnerId || '').trim();
    const stars = Math.min(5, Math.max(1, parseInt(String(rating), 10) || 0));
    if (!pid) return sendFail(res, 'partnerId required', 400);
    if (!stars) return sendFail(res, 'rating (1-5) required', 400);

    const id = `rev_manual_${Date.now()}_${randomInt(100, 1000)}`;
    const bookingId = `manual_${req.userId}_${pid}_${Date.now()}`;
    const rev = await Review.create({
      id,
      bookingId,
      userId: req.userId,
      serviceId: 'manual',
      partnerId: pid,
      stars,
      tags: [],
      note: String(comment).slice(0, 2000),
      pointsEarned: 0,
    });

    return sendOk(res, { id: rev.id, userId: rev.userId, partnerId: rev.partnerId, rating: rev.stars, comment: rev.note || '' }, 'Review created', 201);
  } catch (e) {
    next(e);
  }
}

