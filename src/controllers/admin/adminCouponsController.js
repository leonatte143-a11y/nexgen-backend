import { randomUUID } from 'crypto';
import { Coupon } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';

export async function listCoupons(_req, res, next) {
  try {
    return sendOk(res, await Coupon.findAll({ order: [['createdAt', 'DESC']] }));
  } catch (e) {
    next(e);
  }
}

export async function createCoupon(req, res, next) {
  try {
    const { code, discountType, discountValue, minOrderAmount, maxUses, city, expiresAt } = req.body;
    if (!code || discountValue == null) return sendFail(res, 'code and discountValue required', 400);
    const c = await Coupon.create({
      id: `cp_${randomUUID().slice(0, 10)}`,
      code: String(code).toUpperCase(),
      discountType: discountType || 'flat',
      discountValue,
      minOrderAmount,
      maxUses,
      city,
      expiresAt,
      active: true,
    });
    await recordAdminAction(req.adminId, 'coupon_create', { entityType: 'coupon', entityId: c.id });
    return sendOk(res, c, 'Coupon created');
  } catch (e) {
    next(e);
  }
}

export async function updateCoupon(req, res, next) {
  try {
    const c = await Coupon.findByPk(req.params.id);
    if (!c) return sendFail(res, 'Coupon not found', 404);
    await c.update({
      active: req.body.active ?? c.active,
      discountValue: req.body.discountValue ?? c.discountValue,
      expiresAt: req.body.expiresAt ?? c.expiresAt,
    });
    return sendOk(res, c);
  } catch (e) {
    next(e);
  }
}
