import { sendFail } from '../utils/apiResponse.js';
import { devLog, isDevLoggingEnabled, maskPayload } from '../utils/devLogger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const requestId = req.requestId || 'unknown';
  const route = `${req.method} ${req.originalUrl || req.url}`;

  if (isDevLoggingEnabled()) {
    devLog('ERROR', err.message || 'Internal error', {
      requestId,
      route,
      status: err.status || err.statusCode || 500,
      isApiError: Boolean(err.isApiError),
      stack: err.stack,
      body: req.body ? maskPayload(req.body) : undefined,
      userId: req.userId,
      partnerId: req.partnerId,
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(`[${requestId}]`, route, err.message);
  }

  if (err.isApiError) {
    return sendFail(res, err.message, err.status, err.data);
  }

  const code = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && code === 500
      ? 'Internal error'
      : err.message || 'Internal error';

  return sendFail(res, message, code);
}
