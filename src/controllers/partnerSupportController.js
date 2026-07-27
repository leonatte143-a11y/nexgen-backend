import { SupportConversation } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { getOrCreateConversation, listMessages, sendMessage } from '../services/chatService.js';

export async function startOrGetConversation(req, res, next) {
  try {
    const { bookingId } = req.body || {};
    const conv = await getOrCreateConversation({ partnerId: req.partnerId, bookingId, channel: 'customer' });
    const messages = await listMessages(conv.id);
    return sendOk(res, { conversation: conv, messages });
  } catch (e) {
    next(e);
  }
}

export async function sendPartnerMessage(req, res, next) {
  try {
    const conv = await SupportConversation.findOne({ where: { id: req.params.id, partnerId: req.partnerId } });
    if (!conv) return sendFail(res, 'Conversation not found', 404);
    const row = await sendMessage({
      conversationId: conv.id,
      senderType: 'partner',
      senderId: req.partnerId,
      message: req.body?.message,
    });
    return sendOk(res, row, 'Message sent');
  } catch (e) {
    next(e);
  }
}
