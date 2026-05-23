import { randomUUID } from 'crypto';
import { SupportTicket, Booking, User } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';

export async function listTickets(req, res, next) {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const rows = await SupportTicket.findAll({ where, order: [['createdAt', 'DESC']] });
    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function createTicket(req, res, next) {
  try {
    const { bookingId, userId, partnerId, subject, description, chatTranscript } = req.body;
    if (!subject) return sendFail(res, 'subject required', 400);
    const t = await SupportTicket.create({
      id: `tk_${randomUUID().slice(0, 10)}`,
      bookingId,
      userId,
      partnerId,
      subject,
      description,
      chatTranscript: chatTranscript || [],
      status: 'open',
    });
    return sendOk(res, t, 'Ticket created');
  } catch (e) {
    next(e);
  }
}

export async function updateTicket(req, res, next) {
  try {
    const t = await SupportTicket.findByPk(req.params.id);
    if (!t) return sendFail(res, 'Ticket not found', 404);
    await t.update({
      status: req.body.status ?? t.status,
      priority: req.body.priority ?? t.priority,
    });
    return sendOk(res, t);
  } catch (e) {
    next(e);
  }
}

export async function freezePayment(req, res, next) {
  try {
    const t = await SupportTicket.findByPk(req.params.id);
    if (!t) return sendFail(res, 'Ticket not found', 404);
    await t.update({ paymentFrozen: true, status: 'investigating' });
    if (t.bookingId) {
      const b = await Booking.findByPk(t.bookingId);
      if (b) await b.update({ partnerStatus: 'payment_frozen' });
    }
    await recordAdminAction(req.adminId, 'payment_freeze', { entityType: 'ticket', entityId: t.id });
    return sendOk(res, t, 'Payment frozen');
  } catch (e) {
    next(e);
  }
}

export async function triggerRefund(req, res, next) {
  try {
    const t = await SupportTicket.findByPk(req.params.id);
    if (!t) return sendFail(res, 'Ticket not found', 404);
    if (t.userId) {
      const u = await User.findByPk(t.userId);
      if (u) await u.update({ rewardPoints: (u.rewardPoints || 0) + 50 });
    }
    await t.update({ status: 'refunded' });
    await recordAdminAction(req.adminId, 'refund_trigger', { entityType: 'ticket', entityId: t.id });
    return sendOk(res, t, 'Refund credited to wallet points');
  } catch (e) {
    next(e);
  }
}
