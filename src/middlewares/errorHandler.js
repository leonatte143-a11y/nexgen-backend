import { sendFail } from '../utils/apiResponse.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.isApiError) {
    return sendFail(res, err.message, err.status, err.data);
  }
  console.error(err);
  const code = err.status || err.statusCode || 500;
  return sendFail(res, err.message || 'Internal error', code);
}
