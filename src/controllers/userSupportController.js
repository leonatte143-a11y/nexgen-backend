import { randomUUID } from 'crypto';
import { SupportTicket, Booking, SupportConversation } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { getOrCreateConversation, listMessages, sendMessage, linkConversationToTicket, getLinkedTicket } from '../services/chatService.js';

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

    // Link this ticket to the user's general support conversation so the merged mobile
    // "Conversations" screen can show ticket status alongside the live chat thread.
    await linkConversationToTicket({ userId: req.userId, ticketId: ticket.id });

    return sendOk(res, ticket, 'Support ticket created');
  } catch (e) {
    next(e);
  }
}

export async function startOrGetConversation(req, res, next) {
  try {
    const { bookingId } = req.body || {};
    let partnerId = null;
    if (bookingId) {
      const booking = await Booking.findOne({ where: { id: bookingId, userId: req.userId } });
      if (booking) partnerId = booking.partnerId;
    }
    const conv = await getOrCreateConversation({ userId: req.userId, partnerId, bookingId, channel: 'customer' });
    const messages = await listMessages(conv.id);
    const ticket = await getLinkedTicket(conv);
    return sendOk(res, { conversation: conv, messages, ticket });
  } catch (e) {
    next(e);
  }
}

export async function sendUserMessage(req, res, next) {
  try {
    const conv = await SupportConversation.findOne({ where: { id: req.params.id, userId: req.userId } });
    if (!conv) return sendFail(res, 'Conversation not found', 404);
    const row = await sendMessage({
      conversationId: conv.id,
      senderType: 'user',
      senderId: req.userId,
      message: req.body?.message,
    });
    return sendOk(res, row, 'Message sent');
  } catch (e) {
    next(e);
  }
}
