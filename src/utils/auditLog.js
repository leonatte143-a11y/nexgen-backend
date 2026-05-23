import { randomUUID } from 'crypto';
import { AdminAuditLog } from '../models/index.js';

export async function recordAdminAction(adminId, action, { entityType, entityId, meta } = {}) {
  try {
    await AdminAuditLog.create({
      id: `audit_${randomUUID().slice(0, 12)}`,
      adminId,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      meta: meta || null,
    });
  } catch {
    /* non-blocking */
  }
}
