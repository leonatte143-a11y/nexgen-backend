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

/** Attach userId when a valid user token is present; otherwise continue anonymously. */
export function optionalUser(req, res, next) {
  const t = bearer(req);
  if (!t) return next();
  try {
    const payload = verifyToken(t, 'user');
    if (payload.role === 'user') {
      req.userId = payload.sub;
      req.userPhone = payload.phone;
    }
  } catch {
    /* ignore invalid token for optional auth */
  }
  next();
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

/** Accepts either a valid user or partner token — for P2P marketplace endpoints usable by both. */
export function requireUserOrPartner(req, res, next) {
  const t = bearer(req);
  if (!t) return sendFail(res, 'Authentication required', 401);
  try {
    const payload = verifyToken(t, 'user');
    if (payload.role === 'user') {
      req.sellerRole = 'user';
      req.sellerId = payload.sub;
      req.userId = payload.sub;
      return next();
    }
  } catch {
    /* try partner token next */
  }
  try {
    const payload = verifyToken(t, 'partner');
    if (payload.role === 'partner') {
      req.sellerRole = 'partner';
      req.sellerId = payload.sub;
      req.partnerId = payload.sub;
      return next();
    }
  } catch {
    /* fall through to failure */
  }
  return sendFail(res, 'Invalid or expired token', 401);
}

export function requireAdmin(req, res, next) {
  const t = bearer(req);
  if (!t) {
    if (isDevLoggingEnabled()) {
      devLog('AUTH', 'Admin token missing', { requestId: req.requestId, route: req.originalUrl });
    }
    return sendFail(res, 'Authentication required', 401);
  }
  try {
    const payload = verifyToken(t, 'admin');
    if (payload.role !== 'admin') {
      return sendFail(res, 'Invalid token for this resource', 403);
    }
    req.adminId = payload.sub;
    req.adminRole = payload.adminRole || payload.staffRole || 'admin';
    req.adminEmail = payload.email;
    req.adminPermissions = Array.isArray(payload.permissions) ? payload.permissions : null;
    next();
  } catch {
    return sendFail(res, 'Invalid or expired token', 401);
  }
}
