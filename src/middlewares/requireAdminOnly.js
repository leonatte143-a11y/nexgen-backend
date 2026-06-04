import { sendFail } from '../utils/apiResponse.js';
import { normalizeAdminRole } from '../constants/rbac.js';

/** Restrict route to full admin role (not manager/hr). */
export function requireAdminOnly(req, res, next) {
  if (normalizeAdminRole(req.adminRole) !== 'admin') {
    return sendFail(res, 'Only administrators can perform this action', 403);
  }
  next();
}
