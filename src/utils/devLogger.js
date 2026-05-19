/**
 * Structured development logging — disabled in production unless API_DEBUG=true.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'authorization',
  'otp',
  'debugOtp',
  'jwt',
  'secret',
]);

export function isDevLoggingEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.API_DEBUG === 'true';
}

function maskValue(key, value) {
  if (value == null) return value;
  const k = String(key).toLowerCase();
  if (SENSITIVE_KEYS.has(k) || k.includes('token') || k.includes('secret')) {
    if (typeof value === 'string' && value.length > 8) {
      return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
    }
    return '***';
  }
  if (k === 'phone' && typeof value === 'string') {
    const d = value.replace(/\D/g, '');
    if (d.length >= 4) return `***${d.slice(-4)}`;
  }
  return value;
}

export function maskPayload(obj, depth = 0) {
  if (depth > 4) return '[max depth]';
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => maskPayload(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = maskPayload(v, depth + 1);
    } else {
      out[k] = maskValue(k, v);
    }
  }
  return out;
}

function ts() {
  return new Date().toISOString();
}

function line(parts) {
  // eslint-disable-next-line no-console
  console.log(parts.filter(Boolean).join(' '));
}

export function devLog(tag, message, meta) {
  if (!isDevLoggingEnabled()) return;
  const rid = meta?.requestId ? `[${meta.requestId}]` : '';
  line([`[${ts()}]`, rid, `[${tag}]`, message]);
  if (meta && Object.keys(meta).length) {
    const { requestId: _r, ...rest } = meta;
    if (Object.keys(rest).length) {
      // eslint-disable-next-line no-console
      console.log(maskPayload(rest));
    }
  }
}

/** Controller / domain action logs */
export function ctrlLog(domain, message, req, extra = {}) {
  if (!isDevLoggingEnabled()) return;
  devLog(domain.toUpperCase(), message, {
    requestId: req?.requestId,
    userId: req?.userId,
    partnerId: req?.partnerId,
    adminId: req?.adminId,
    route: req ? `${req.method} ${req.originalUrl || req.url}` : undefined,
    ...extra,
  });
}

/** Sequelize SQL */
export function dbLog(sql, timingMs) {
  if (!isDevLoggingEnabled()) return;
  const timing = timingMs != null ? ` (${timingMs}ms)` : '';
  line([`[${ts()}]`, '[DB]', `${sql}${timing}`]);
}
