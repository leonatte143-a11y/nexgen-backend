import { Op } from 'sequelize';
import { AdminAuditLog, AdminUser } from '../../models/index.js';
import { sendOk } from '../../utils/apiResponse.js';

export async function listAuditLogs(req, res, next) {
  try {
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const action = req.query.action;
    const roleFilter = req.query.role;

    const where = {};
    if (action) where.action = action;

    const { count, rows } = await AdminAuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const adminIds = [...new Set(rows.map((r) => r.adminId))];
    const admins = await AdminUser.findAll({ where: { id: adminIds } });
    const adminMap = new Map(admins.map((a) => [a.id, a]));

    let items = rows.map((r) => {
      const meta = r.meta || {};
      const admin = adminMap.get(r.adminId);
      return {
        id: r.id,
        timestamp: r.createdAt,
        role: meta.staffRole || admin?.role || 'admin',
        staffName: meta.staffName || admin?.name || admin?.email || r.adminId,
        actionTaken: meta.actionTaken || r.action,
        action: r.action,
        ipAddress: meta.ipAddress || null,
        location: meta.location || null,
        entityType: r.entityType,
        entityId: r.entityId,
        meta,
      };
    });

    if (roleFilter) {
      const rf = String(roleFilter).toLowerCase();
      items = items.filter((i) => String(i.role || '').toLowerCase() === rf);
    }

    return sendOk(res, { items, total: roleFilter ? items.length : count, limit, offset }, 'ok');
  } catch (e) {
    next(e);
  }
}
