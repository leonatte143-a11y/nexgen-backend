import { FraudFlag, Booking, User, Partner } from '../../models/index.js';
import { sendOk } from '../../utils/apiResponse.js';

export async function listFraudFlags(_req, res, next) {
  try {
    const rows = await FraudFlag.findAll({ order: [['createdAt', 'DESC']], limit: 100 });
    return sendOk(res, rows, 'ok');
  } catch (e) {
    next(e);
  }
}

/** Scan recent bookings for same-IP / repeated cancellation patterns (foundation). */
export async function scanFraudSignals(_req, res, next) {
  try {
    const bookings = await Booking.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    const flags = [];
    const cancelByUser = new Map();
    for (const b of bookings) {
      if (b.userStatus === 'cancelled') {
        cancelByUser.set(b.userId, (cancelByUser.get(b.userId) || 0) + 1);
      }
    }
    for (const [userId, count] of cancelByUser) {
      if (count >= 3) {
        flags.push({
          entityType: 'user',
          entityId: userId,
          rule: 'repeated_cancellations',
          severity: 'medium',
          details: { count },
        });
      }
    }
    return sendOk(res, { scanned: bookings.length, flags }, 'ok');
  } catch (e) {
    next(e);
  }
}
