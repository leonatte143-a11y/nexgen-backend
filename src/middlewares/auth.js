import { verifyToken } from '../utils/jwt.js';
import { sendFail } from '../utils/apiResponse.js';

function bearer(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7);
}

export function requireUser(req, res, next) {
  const t = bearer(req);
  if (!t) return sendFail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(t, 'user');
    req.userId = payload.sub;
    req.userPhone = payload.phone;
    next();
  } catch {
    return sendFail(res, 'Invalid or expired token', 401);
  }
}

export function requirePartner(req, res, next) {
  const t = bearer(req);
  if (!t) return sendFail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(t, 'partner');
    req.partnerId = payload.sub;
    req.partnerPhone = payload.phone;
    next();
  } catch {
    return sendFail(res, 'Invalid or expired token', 401);
  }
}

export function requireAdmin(req, res, next) {
  const t = bearer(req);
  if (!t) return sendFail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(t, 'admin');
    req.adminId = payload.sub;
    next();
  } catch {
    return sendFail(res, 'Invalid or expired token', 401);
  }
}
