import { PartnerServicePricing, Partner } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { toNum } from '../../serializers/formatters.js';
import { normalizeAdminRole } from '../../constants/rbac.js';

function mapPendingRow(row, partner) {
  return {
    id: row.id,
    partnerId: row.partnerId,
    partnerName: partner?.name || row.partnerId,
    serviceName: row.serviceName,
    category: row.category,
    proposedPrice: toNum(row.baseCost),
    currentPrice: row.previousBaseCost != null ? toNum(row.previousBaseCost) : null,
    status: row.approvalStatus,
    isActive: Boolean(row.isActive),
    submittedAt: row.updatedAt || row.createdAt,
    rejectionReason: row.rejectionReason || null,
    reviewedAt: row.reviewedAt || null,
  };
}

export async function listPendingPartnerPrices(req, res, next) {
  try {
    const rows = await PartnerServicePricing.findAll({
      where: { approvalStatus: 'pending_review' },
      order: [['updatedAt', 'DESC']],
    });
    const partnerIds = [...new Set(rows.map((r) => r.partnerId))];
    const partners = await Partner.findAll({ where: { id: partnerIds } });
    const pMap = new Map(partners.map((p) => [p.id, p]));
    return sendOk(res, rows.map((r) => mapPendingRow(r, pMap.get(r.partnerId))));
  } catch (e) {
    next(e);
  }
}

export async function approvePartnerPrice(req, res, next) {
  try {
    if (normalizeAdminRole(req.adminRole) !== 'admin') {
      return sendFail(res, 'Only administrators can approve prices', 403);
    }
    const row = await PartnerServicePricing.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Not found', 404);
    if (row.approvalStatus !== 'pending_review') {
      return sendFail(res, 'Price is not pending review', 400);
    }
    await row.update({
      approvalStatus: 'approved',
      isActive: true,
      reviewedBy: req.adminId,
      reviewedAt: new Date(),
      rejectionReason: null,
    });
    const partner = await Partner.findByPk(row.partnerId);
    await recordAdminAction(req.adminId, 'partner_price_approve', {
      entityType: 'partner_service_pricing',
      entityId: row.id,
      meta: {
        partnerName: partner?.name,
        serviceName: row.serviceName,
        price: toNum(row.baseCost),
        label: `Approved partner price: ${row.serviceName} (₹${toNum(row.baseCost)})`,
      },
      req,
    });
    return sendOk(res, mapPendingRow(row, partner), 'Price approved');
  } catch (e) {
    next(e);
  }
}

export async function rejectPartnerPrice(req, res, next) {
  try {
    if (normalizeAdminRole(req.adminRole) !== 'admin') {
      return sendFail(res, 'Only administrators can reject prices', 403);
    }
    const reason = String(req.body.reason || '').trim();
    if (!reason) return sendFail(res, 'Rejection reason is required', 400);
    const row = await PartnerServicePricing.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Not found', 404);
    if (row.approvalStatus !== 'pending_review') {
      return sendFail(res, 'Price is not pending review', 400);
    }
    await row.update({
      approvalStatus: 'rejected',
      isActive: false,
      reviewedBy: req.adminId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    });
    const partner = await Partner.findByPk(row.partnerId);
    await recordAdminAction(req.adminId, 'partner_price_reject', {
      entityType: 'partner_service_pricing',
      entityId: row.id,
      meta: {
        partnerName: partner?.name,
        serviceName: row.serviceName,
        reason,
        label: `Rejected partner price: ${row.serviceName}`,
      },
      req,
    });
    return sendOk(res, mapPendingRow(row, partner), 'Price rejected');
  } catch (e) {
    next(e);
  }
}
