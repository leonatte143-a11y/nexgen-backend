import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { SupportConversation, SupportMessage, SupportTicket } from '../models/index.js';
import { emitToConversation } from '../realtime/chatSocket.js';

/** Universal Super-Chat: every conversation is tagged with User/Partner/Booking IDs so
 * User, Partner, and Admin all resolve to the same thread regardless of who started it. */
export async function getOrCreateConversation({ userId, partnerId, bookingId, channel = 'customer' }) {
  const where = {};
  if (bookingId) where.bookingId = bookingId;
  else {
    if (userId) where.userId = userId;
    if (partnerId) where.partnerId = partnerId;
  }
  where.status = { [Op.ne]: 'closed' };

  let conv = await SupportConversation.findOne({ where, order: [['createdAt', 'DESC']] });
  if (!conv) {
    conv = await SupportConversation.create({
      id: `conv_${randomUUID().slice(0, 12)}`,
      userId: userId || null,
      partnerId: partnerId || null,
      bookingId: bookingId || null,
      channel,
      status: 'open',
    });
  }
  return conv;
}

export async function listMessages(conversationId) {
  return SupportMessage.findAll({ where: { conversationId }, order: [['createdAt', 'ASC']] });
}

export async function sendMessage({ conversationId, senderType, senderId, message }) {
  const conv = await SupportConversation.findByPk(conversationId);
  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });

  const text = String(message ?? '').trim().slice(0, 2000);
  if (!text) throw Object.assign(new Error('message required'), { status: 400 });

  const row = await SupportMessage.create({
    id: `msg_${randomUUID().slice(0, 12)}`,
    conversationId,
    senderType,
    senderId: senderId || null,
    message: text,
  });

  await conv.update({
    lastMessage: text,
    lastMessageAt: row.createdAt,
    status: conv.status === 'closed' ? 'open' : conv.status,
    unreadCount: senderType === 'admin' ? 0 : (conv.unreadCount || 0) + 1,
  });

  emitToConversation(conversationId, 'message:new', { conversationId, message: row });
  return row;
}

/** Populates the vestigial SupportConversation.ticketId link: get-or-creates the user/partner's
 * general support conversation and tags it with a newly-raised ticket, so the mobile
 * "Conversations" screen can show ticket status alongside the live chat thread. */
export async function linkConversationToTicket({ userId, partnerId, bookingId, ticketId }) {
  const conv = await getOrCreateConversation({ userId, partnerId, bookingId, channel: 'customer' });
  if (conv.ticketId !== ticketId) {
    await conv.update({ ticketId });
  }
  return conv;
}

/** Fetches a conversation's linked ticket (subject/status/priority), if any, so callers can
 * surface it inline with the chat thread without a separate mobile round-trip. */
export async function getLinkedTicket(conversation) {
  if (!conversation?.ticketId) return null;
  return SupportTicket.findByPk(conversation.ticketId);
}

export async function claimConversation(conversationId, adminId) {
  const conv = await SupportConversation.findByPk(conversationId);
  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  await conv.update({ claimedByAdminId: adminId, claimedAt: new Date(), unreadCount: 0 });
  emitToConversation(conversationId, 'conversation:claimed', { conversationId, claimedByAdminId: adminId });
  return conv;
}
