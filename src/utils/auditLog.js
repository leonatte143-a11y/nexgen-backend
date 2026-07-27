import { randomUUID } from 'crypto';
import { AdminAuditLog, AdminUser } from '../models/index.js';
import { normalizeAdminRole } from '../constants/rbac.js';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function humanizeAction(action, meta) {
  if (meta?.label) return String(meta.label);
  const map = {
    kyc_approve: `Approved partner KYC${meta?.name ? `: ${meta.name}` : ''}`,
    kyc_reject: `Rejected partner KYC${meta?.name ? `: ${meta.name}` : ''}`,
    booking_assign: 'Reassigned booking to partner',
    booking_reassign: `Reassigned booking${meta?.reason ? `: ${meta.reason}` : ''}`,
    partner_update: 'Updated partner profile',
    partner_warn: `Sent warning to partner${meta?.name ? `: ${meta.name}` : ''}`,
    partner_freeze: `Froze partner account${meta?.name ? `: ${meta.name}` : ''}`,
    partner_block: `Blocked partner${meta?.name ? `: ${meta.name}` : ''}`,
    partner_archive: `Archived partner${meta?.name ? `: ${meta.name}` : ''}`,
    service_zone_establish: `Established service zone${meta?.city ? `: ${meta.city}` : ''}`,
    payout_generate: 'Generated Monday payout report',
    settings_update: 'Updated global settings',
    maps_key_update: 'Updated Google Maps API key',
    chat_join: meta?.label || 'Joined support conversation',
    price_update: `Changed service price${meta?.serviceName ? `: ${meta.serviceName}` : ''}`,
    partner_price_approve: meta?.label || 'Approved partner service price',
    partner_price_reject: meta?.label || 'Rejected partner service price',
  };
  return map[action] || action.replace(/_/g, ' ');
}

export async function recordAdminAction(adminId, action, { entityType, entityId, meta, req } = {}) {
  try {
    let staffName = meta?.staffName || null;
    let staffRole = meta?.staffRole || null;
    if (req?.adminRole) staffRole = normalizeAdminRole(req.adminRole);
    if (!staffName && adminId) {
      const admin = await AdminUser.findByPk(adminId, { attributes: ['name', 'role', 'email'] });
      staffName = admin?.name || admin?.email || adminId;
      staffRole = staffRole || normalizeAdminRole(admin?.role);
    }
    const ipAddress = req ? clientIp(req) : meta?.ipAddress || null;
    const actionTaken = humanizeAction(action, meta);

    await AdminAuditLog.create({
      id: `audit_${randomUUID().slice(0, 12)}`,
      adminId,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      meta: {
        ...(meta || {}),
        staffName,
        staffRole,
        ipAddress,
        actionTaken,
        location: meta?.location || meta?.city || null,
      },
    });
  } catch {
    /* non-blocking */
  }
}
