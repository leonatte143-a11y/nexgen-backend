import { sendFail } from '../utils/apiResponse.js';
import { normalizeAdminRole, roleHasAnyPermission, roleHasPermission } from '../constants/rbac.js';

export function requirePermission(...permissions) {
  return (req, res, next) => {
    const adminRole = normalizeAdminRole(req.adminRole);
    const ok = permissions.some((p) => roleHasPermission(adminRole, p));
    if (!ok) {
      return sendFail(res, 'Insufficient permissions for this action', 403);
    }
    next();
  };
}

export function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const adminRole = normalizeAdminRole(req.adminRole);
    if (!roleHasAnyPermission(adminRole, permissions)) {
      return sendFail(res, 'Insufficient permissions for this action', 403);
    }
    next();
  };
}
