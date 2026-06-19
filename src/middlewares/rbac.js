import { sendFail } from '../utils/apiResponse.js';
import { normalizeAdminRole, roleHasAnyPermission, roleHasPermission } from '../constants/rbac.js';

export function requirePermission(...permissions) {
  return (req, res, next) => {
    const adminRole = normalizeAdminRole(req.adminRole);
    const custom = req.adminPermissions;
    const ok = permissions.some((p) => roleHasPermission(adminRole, p, custom));
    if (!ok) {
      return sendFail(res, 'Insufficient permissions for this action', 403);
    }
    next();
  };
}

export function requireAnyPermission(permissions) {
  return (req, res, next) => {
    const adminRole = normalizeAdminRole(req.adminRole);
    if (!roleHasAnyPermission(adminRole, permissions, req.adminPermissions)) {
      return sendFail(res, 'Insufficient permissions for this action', 403);
    }
    next();
  };
}
