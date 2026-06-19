import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { Partner, PartnerWarning, Booking, Review, ArchivedPartner } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toPartnerProfile } from '../../serializers/mappers.js';
import { recordAdminAction } from '../../utils/auditLog.js';

export async function warnPartner(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    const { reason } = req.body;
    await PartnerWarning.create({
      id: `pw_${randomUUID().slice(0, 10)}`,
      partnerId: p.id,
      adminId: req.adminId,
      reason: reason || 'Policy violation',
    });
    const warningCount = (p.warningCount || 0) + 1;
    await p.update({ warningCount, strikeCount: Math.max(p.strikeCount, warningCount) });
    await recordAdminAction(req.adminId, 'partner_warn', {
      entityType: 'partner',
      entityId: p.id,
      meta: { name: p.name, reason, suggestFreeze: warningCount >= 3 },
      req,
    });
    return sendOk(res, { ...toPartnerProfile(p), warningCount, suggestFreeze: warningCount >= 3 }, 'Warning sent');
  } catch (e) {
    next(e);
  }
}

export async function freezePartner(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    const days = parseInt(req.body.days, 10) || 7;
    const freezeUntil = new Date();
    freezeUntil.setDate(freezeUntil.getDate() + days);
    await p.update({
      isFrozen: true,
      freezeUntil,
      isOnline: false,
      accountStatus: 'frozen',
      strikeCount: Math.max(p.strikeCount, 1),
    });
    await recordAdminAction(req.adminId, 'partner_freeze', {
      entityType: 'partner',
      entityId: p.id,
      meta: { name: p.name, freezeUntil: freezeUntil.toISOString() },
      req,
    });
    return sendOk(res, toPartnerProfile(p), `Partner frozen until ${freezeUntil.toISOString().slice(0, 10)}`);
  } catch (e) {
    next(e);
  }
}

export async function blockPartner(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    await p.update({ isBlocked: true, isOnline: false, accountStatus: 'blocked' });
    await recordAdminAction(req.adminId, 'partner_block', {
      entityType: 'partner',
      entityId: p.id,
      meta: { name: p.name },
      req,
    });
    return sendOk(res, toPartnerProfile(p), 'Partner blocked');
  } catch (e) {
    next(e);
  }
}

export async function archivePartner(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    if (p.archivedAt) return sendFail(res, 'Partner already archived', 409);

    const archivedAt = new Date();
    await ArchivedPartner.create({
      id: `ap_${randomUUID().slice(0, 10)}`,
      partnerId: p.id,
      snapshot: {
        id: p.id,
        name: p.name,
        phone: p.phone,
        walletBalance: p.walletBalance,
        rating: p.rating,
        jobsCompleted: p.jobsCompleted,
        verificationStatus: p.verificationStatus,
        primaryCity: p.primaryCity,
        accountStatus: p.accountStatus,
      },
      archivedBy: req.adminId || null,
      archivedAt,
    });

    await p.update({ archivedAt, isOnline: false, accountStatus: 'archived' });
    await recordAdminAction(req.adminId, 'partner_archive', {
      entityType: 'partner',
      entityId: p.id,
      meta: { name: p.name },
      req,
    });
    return sendOk(res, toPartnerProfile(p), 'Partner removed from live platform');
  } catch (e) {
    next(e);
  }
}

export async function unfreezePartner(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    await p.update({ isFrozen: false, freezeUntil: null, accountStatus: 'active' });
    await recordAdminAction(req.adminId, 'partner_unfreeze', {
      entityType: 'partner',
      entityId: p.id,
      meta: { name: p.name },
      req,
    });
    return sendOk(res, toPartnerProfile(p), 'Partner unfrozen');
  } catch (e) {
    next(e);
  }
}

export async function strikeBoard(_req, res, next) {
  try {
    const partners = await Partner.findAll({ order: [['strikeCount', 'DESC']], limit: 100 });
    const bookings = await Booking.findAll({
      where: { partnerStatus: 'cancelled' },
      attributes: ['partnerId'],
    });
    const cancelMap = new Map();
    for (const b of bookings) {
      if (!b.partnerId) continue;
      cancelMap.set(b.partnerId, (cancelMap.get(b.partnerId) || 0) + 1);
    }
    const reviews = await Review.findAll({ where: { stars: { [Op.lte]: 1 } } });
    const lowRatingMap = new Map();
    for (const r of reviews) {
      const pid = r.partnerId;
      if (!pid) continue;
      lowRatingMap.set(pid, (lowRatingMap.get(pid) || 0) + 1);
    }
    const items = partners
      .filter((p) => p.strikeCount > 0 || p.warningCount > 0 || p.isFrozen || p.isBlocked || cancelMap.get(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        strikeCount: p.strikeCount,
        warningCount: p.warningCount,
        cancellations: cancelMap.get(p.id) || 0,
        lowRatings: lowRatingMap.get(p.id) || 0,
        isFrozen: p.isFrozen,
        isBlocked: p.isBlocked,
        accountStatus: p.accountStatus,
        rating: p.rating,
      }))
      .sort((a, b) => b.strikeCount - a.strikeCount);
    return sendOk(res, items, 'ok');
  } catch (e) {
    next(e);
  }
}
