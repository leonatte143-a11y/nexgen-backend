import { randomUUID } from 'crypto';
import { SupportTicket, Booking } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';

export async function listMyTickets(req, res, next) {
  try {
    const rows = await SupportTicket.findAll({
      where: { userId: req.userId },
      order: [['updatedAt', 'DESC']],
    });
    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function createTicket(req, res, next) {
  try {
    const { bookingId, subject, description = '' } = req.body;

    if (!subject || !String(subject).trim()) {
      return sendFail(res, 'subject required', 400);
    }

    let partnerId = null;
    if (bookingId) {
      const booking = await Booking.findOne({ where: { id: bookingId, userId: req.userId } });
      if (!booking) {
        return sendFail(res, 'Booking not found', 404);
      }
      partnerId = booking.partnerId;
    }

    const ticket = await SupportTicket.create({
      id: `tk_${randomUUID().slice(0, 10)}`,
      bookingId: bookingId || null,
      userId: req.userId,
      partnerId,
      subject: String(subject).trim().slice(0, 256),
      description: String(description || '').slice(0, 2000),
      status: 'open',
    });

    return sendOk(res, ticket, 'Support ticket created');
  } catch (e) {
    next(e);
  }
}
