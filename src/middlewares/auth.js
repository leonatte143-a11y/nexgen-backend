import { verifyToken } from '../utils/jwt.js';
import { sendFail } from '../utils/apiResponse.js';
import { devLog, isDevLoggingEnabled } from '../utils/devLogger.js';

function bearer(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

export function requireUser(req, res, next) {
  const t = bearer(req);
  if (!t) return sendFail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(t, 'user');
    if (payload.role !== 'user') {
      return sendFail(res, 'Invalid token for this resource', 403);
    }
    req.userId = payload.sub;
    req.userPhone = payload.phone;
    next();
  } catch {
    if (isDevLoggingEnabled()) {
      devLog('AUTH', 'User token rejected', { requestId: req.requestId, route: req.originalUrl });
    }
    return sendFail(res, 'Invalid or expired token', 401);
  }
}

export function requirePartner(req, res, next) {
  const t = bearer(req);
  if (!t) return sendFail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(t, 'partner');
    if (payload.role !== 'partner') {
      return sendFail(res, 'Invalid token for this resource', 403);
    }
    req.partnerId = payload.sub;
    req.partnerPhone = payload.phone;
    next();
  } catch {
    if (isDevLoggingEnabled()) {
      devLog('AUTH', 'Partner token rejected', { requestId: req.requestId, route: req.originalUrl });
    }
    return sendFail(res, 'Invalid or expired token', 401);
  }
}

export function requireAdmin(req, res, next) {
  const t = bearer(req);
  if (!t) return sendFail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(t, 'admin');
    if (payload.role !== 'admin') {
      return sendFail(res, 'Invalid token for this resource', 403);
    }
    req.adminId = payload.sub;
    req.adminRole = payload.adminRole || payload.staffRole || 'admin';
    req.adminEmail = payload.email;
    next();
  } catch {
    return sendFail(res, 'Invalid or expired token', 401);
  }
}
