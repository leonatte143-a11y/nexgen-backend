import { Op } from 'sequelize';
import { SupportConversation, SupportMessage, ChatSetting } from '../../models/index.js';
import { sendOk } from '../../utils/apiResponse.js';

const DEFAULT_FORBIDDEN = ['pay me cash', 'offline', 'mobile number', 'direct payment'];

async function getOrCreateSettings() {
  let row = await ChatSetting.findByPk('global');
  if (!row) {
    row = await ChatSetting.create({
      id: 'global',
      chatEnabled: true,
      imageSharingEnabled: true,
      autoTranslationEnabled: false,
      forbiddenWords: DEFAULT_FORBIDDEN,
    });
  }
  return row;
}

export async function listChats(_req, res, next) {
  try {
    const rows = await SupportConversation.findAll({
      where: { status: { [Op.ne]: 'closed' } },
      order: [['lastMessageAt', 'DESC']],
      limit: 50,
    });
    return sendOk(res, rows, 'ok');
  } catch (e) {
    next(e);
  }
}

export async function getChat(req, res, next) {
  try {
    const conv = await SupportConversation.findByPk(req.params.id);
    if (!conv) return sendOk(res, { conversation: null, messages: [] }, 'not found');
    const messages = await SupportMessage.findAll({
      where: { conversationId: conv.id },
      order: [['createdAt', 'ASC']],
    });
    return sendOk(res, { conversation: conv, messages }, 'ok');
  } catch (e) {
    next(e);
  }
}

export async function chatAlerts(_req, res, next) {
  try {
    const settings = await getOrCreateSettings();
    const words = settings.forbiddenWords || DEFAULT_FORBIDDEN;
    const messages = await SupportMessage.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    const alerts = [];
    for (const m of messages) {
      const body = String(m.message || '').toLowerCase();
      for (const w of words) {
        if (body.includes(String(w).toLowerCase())) {
          alerts.push({
            messageId: m.id,
            conversationId: m.conversationId,
            keyword: w,
            snippet: body.slice(0, 120),
            createdAt: m.createdAt,
          });
          break;
        }
      }
    }
    return sendOk(res, alerts.slice(0, 50), 'ok');
  } catch (e) {
    next(e);
  }
}

export async function updateChatSettings(req, res, next) {
  try {
    const settings = await getOrCreateSettings();
    const patch = {};
    for (const k of ['chatEnabled', 'imageSharingEnabled', 'autoTranslationEnabled', 'forbiddenWords']) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    await settings.update(patch);
    return sendOk(res, settings, 'Chat settings updated');
  } catch (e) {
    next(e);
  }
}
