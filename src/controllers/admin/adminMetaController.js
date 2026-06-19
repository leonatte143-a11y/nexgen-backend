import { User, Partner, AdminUser, StaffProfile } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';

export async function getHoverMeta(req, res, next) {
  try {
    const kind = String(req.query.kind || '');
    const id = String(req.query.id || '');
    if (!kind || !id) return sendFail(res, 'kind and id required', 400);

    if (kind === 'partner') {
      const p = await Partner.findByPk(id);
      if (!p) return sendFail(res, 'Not found', 404);
      return sendOk(res, {
        name: p.name,
        phone: p.phone,
        createdAt: p.createdAt,
        totalJobs: p.jobsCompleted ?? p.totalJobsCount ?? 0,
        rating: Number(p.rating),
      });
    }

    if (kind === 'user') {
      const u = await User.findByPk(id);
      if (!u) return sendFail(res, 'Not found', 404);
      return sendOk(res, {
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.phone,
        phone: u.phone,
        createdAt: u.createdAt,
        totalJobs: 0,
        rating: null,
      });
    }

    if (kind === 'staff') {
      const a = await AdminUser.findByPk(id);
      if (!a) return sendFail(res, 'Not found', 404);
      const profile = await StaffProfile.findOne({ where: { adminUserId: a.id } });
      return sendOk(res, {
        name: a.name || a.email,
        phone: a.phone,
        createdAt: a.createdAt,
        totalJobs: 0,
        rating: null,
        designation: profile?.designation,
      });
    }

    return sendFail(res, 'Invalid kind', 400);
  } catch (e) {
    next(e);
  }
}
