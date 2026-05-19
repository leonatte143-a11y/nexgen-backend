import { randomUUID } from 'node:crypto';
import { devLog, isDevLoggingEnabled, maskPayload } from '../utils/devLogger.js';

function actorFromReq(req) {
  if (req.userId) return `user:${req.userId}`;
  if (req.partnerId) return `partner:${req.partnerId}`;
  if (req.adminId) return `admin:${req.adminId}`;
  return 'anonymous';
}

/**
 * Request tracing: X-Request-Id, structured logs, response timing.
 * Runs before auth middleware on each route; auth fields appear on "finish" if set earlier in chain.
 */
export function requestTraceMiddleware(req, res, next) {
  if (!isDevLoggingEnabled()) {
    return next();
  }

  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim()
      ? incomingId.trim()
      : `REQ-${Date.now()}-${randomUUID().slice(0, 8)}`;

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl || req.url;

  devLog('API IN', `${method} ${path}`, {
    requestId,
    query: Object.keys(req.query || {}).length ? maskPayload(req.query) : undefined,
    body: req.body && Object.keys(req.body).length ? maskPayload(req.body) : undefined,
    contentType: req.headers['content-type'],
    hasAuthHeader: Boolean(req.headers.authorization),
  });

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'API OUT';
    devLog(level, `${method} ${path} → ${res.statusCode} (${ms}ms)`, {
      requestId,
      actor: actorFromReq(req),
      status: res.statusCode,
      durationMs: ms,
    });
  });

  next();
}
