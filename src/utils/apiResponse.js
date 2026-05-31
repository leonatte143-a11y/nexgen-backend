/**
 * Standard API envelope (matches mobile integration expectations for future client swap).
 */
export function ok(data, message = '', status = 200) {
  return { success: true, data, message, status };
}

export function fail(message, status = 400, data = null) {
  const err = new Error(message);
  err.status = status;
  err.data = data;
  err.isApiError = true;
  return err;
}

export function sendOk(res, data, message = '', status = 200) {
  // Always return JSON envelope (never 204) so admin/mobile clients parse consistently
  const httpStatus = status === 204 ? 200 : status;
  return res.status(httpStatus).json({ success: true, data, message: message ?? '' });
}

export function sendFail(res, message, status = 400, data = null) {
  return res.status(status).json({ success: false, data, message });
}
