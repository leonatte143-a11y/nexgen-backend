import { randomUUID } from 'crypto';
import {
  MarketplaceConversation,
  MarketplaceMessage,
  MarketplaceListing,
} from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { maskPhoneNumbers } from '../utils/phoneMask.js';
import { emitToConversation } from '../realtime/chatSocket.js';

function serializeMessage(row, contactShared) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderType: row.senderRole,
    senderId: row.senderId,
    message: contactShared ? row.message : maskPhoneNumbers(row.message),
    createdAt: row.createdAt,
  };
}

export async function startOrGetConversation(req, res, next) {
  try {
    const listingId = req.body?.listingId || req.params.listingId;
    const listing = await MarketplaceListing.findByPk(listingId);
    if (!listing) return sendFail(res, 'Listing not found', 404);

    const isSeller = listing.sellerRole === req.sellerRole && listing.sellerId === req.sellerId;
    if (isSeller) return sendFail(res, 'You cannot start a chat on your own listing', 400);

    let conv = await MarketplaceConversation.findOne({
      where: { listingId, buyerRole: req.sellerRole, buyerId: req.sellerId },
    });
    if (!conv) {
      conv = await MarketplaceConversation.create({
        id: `mconv_${randomUUID().slice(0, 12)}`,
        listingId,
        buyerRole: req.sellerRole,
        buyerId: req.sellerId,
        sellerRole: listing.sellerRole,
        sellerId: listing.sellerId,
      });
    }
    const messages = await MarketplaceMessage.findAll({
      where: { conversationId: conv.id },
      order: [['createdAt', 'ASC']],
    });
    return sendOk(res, {
      conversation: conv,
      messages: messages.map((m) => serializeMessage(m, conv.contactShared)),
    });
  } catch (e) {
    next(e);
  }
}

function assertParticipant(conv, role, id) {
  return (conv.buyerRole === role && conv.buyerId === id) || (conv.sellerRole === role && conv.sellerId === id);
}

export async function sendMessage(req, res, next) {
  try {
    const conv = await MarketplaceConversation.findByPk(req.params.id);
    if (!conv) return sendFail(res, 'Conversation not found', 404);
    if (!assertParticipant(conv, req.sellerRole, req.sellerId)) {
      return sendFail(res, 'Not part of this conversation', 403);
    }
    const text = String(req.body?.message ?? '').trim().slice(0, 2000);
    if (!text) return sendFail(res, 'message required', 400);

    const row = await MarketplaceMessage.create({
      id: `mmsg_${randomUUID().slice(0, 12)}`,
      conversationId: conv.id,
      senderRole: req.sellerRole,
      senderId: req.sellerId,
      message: text,
    });
    await conv.update({ lastMessage: text, lastMessageAt: row.createdAt, status: 'open' });

    const dto = serializeMessage(row, conv.contactShared);
    emitToConversation(conv.id, 'message:new', { conversationId: conv.id, message: dto });
    return sendOk(res, dto, 'Message sent');
  } catch (e) {
    next(e);
  }
}

export async function shareContact(req, res, next) {
  try {
    const conv = await MarketplaceConversation.findByPk(req.params.id);
    if (!conv) return sendFail(res, 'Conversation not found', 404);
    if (!(conv.sellerRole === req.sellerRole && conv.sellerId === req.sellerId)) {
      return sendFail(res, 'Only the seller can share contact details', 403);
    }
    const listing = await MarketplaceListing.findByPk(conv.listingId);
    await conv.update({ contactShared: true });

    const row = await MarketplaceMessage.create({
      id: `mmsg_${randomUUID().slice(0, 12)}`,
      conversationId: conv.id,
      senderRole: conv.sellerRole,
      senderId: conv.sellerId,
      message: `Contact shared: ${listing?.contactPhone || 'phone unavailable'}`,
    });
    await conv.update({ lastMessage: row.message, lastMessageAt: row.createdAt });

    const dto = serializeMessage(row, true);
    emitToConversation(conv.id, 'message:new', { conversationId: conv.id, message: dto });
    return sendOk(res, { conversation: conv, message: dto }, 'Contact shared');
  } catch (e) {
    next(e);
  }
}
