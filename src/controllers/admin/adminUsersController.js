import { User } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toMockUser } from '../../serializers/mappers.js';
import { recordAdminAction } from '../../utils/auditLog.js';

export async function listUsersAdmin(req, res, next) {
  try {
    const { q } = req.query;
    let rows = await User.findAll({ order: [['createdAt', 'DESC']] });
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(
        (u) =>
          u.phone?.includes(s) ||
          u.firstName?.toLowerCase().includes(s) ||
          u.lastName?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s),
      );
    }
    return sendOk(
      res,
      rows.map((u) => ({
        ...toMockUser(u),
        isBlocked: Boolean(u.isBlocked),
        createdAt: u.createdAt,
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function setUserBlocked(req, res, next) {
  try {
    const u = await User.findByPk(req.params.id);
    if (!u) return sendFail(res, 'User not found', 404);
    const blocked = Boolean(req.body.blocked);
    await u.update({ isBlocked: blocked });
    await recordAdminAction(req.adminId, blocked ? 'user_block' : 'user_unblock', {
      entityType: 'user',
      entityId: u.id,
    });
    return sendOk(res, { ...toMockUser(u), isBlocked: u.isBlocked });
  } catch (e) {
    next(e);
  }
}
