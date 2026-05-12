import { randomInt } from 'crypto';
import { Partner, Booking, PartnerServicePricing } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import {
  toPartnerProfile,
  toEarningsSummary,
  toPartnerRequest,
} from '../serializers/mappers.js';
import { timeAgoLabel, toNum } from '../serializers/formatters.js';
import {
  PARTNER_ARRIVAL_CANCELLATION_CREDIT,
  PARTNER_HEAVY_DECLINE_CREDIT,
} from '../services/money.js';

function recalcPartnerEarnings(p) {
  p.rewardPoints = p.rewardPoints || 0;
  return p;
}

export async function applyOnboarding(req, res, next) {
  try {
    const body = req.body;
    const phone = String(body.phone || '').replace(/\D/g, '').slice(0, 10);
    if (phone.length !== 10) return sendFail(res, 'Valid 10-digit phone required', 400);
    const id = `partner_${phone}`;
    const [p, created] = await Partner.findOrCreate({
      where: { phone },
      defaults: {
        id,
        phone,
        name: body.name || 'Partner',
        skills: body.skills || [],
        categories: body.categories || [],
        bankName: body.bankName || '',
        bankAccount: body.bankAccount || '',
        verificationStatus: 'Pending',
      },
    });
    if (!created) {
      await p.update({
        name: body.name || p.name,
        skills: body.skills || p.skills,
        categories: body.categories || p.categories,
        bankName: body.bankName ?? p.bankName,
        bankAccount: body.bankAccount ?? p.bankAccount,
      });
    }
    return sendOk(res, toPartnerProfile(p), 'Onboarding saved');
  } catch (e) {
    next(e);
  }
}

export async function getProfile(req, res, next) {
  try {
    const p = await Partner.findByPk(req.partnerId);
    if (!p) return sendFail(res, 'Partner not found', 404);
    return sendOk(res, toPartnerProfile(p));
  } catch (e) {
    next(e);
  }
}

export async function getRequests(req, res, next) {
  try {
    const rows = await Booking.findAll({
      where: { partnerId: req.partnerId },
      order: [['createdAt', 'DESC']],
    });
    return sendOk(
      res,
      rows.map((b) => {
        const plain = b.get({ plain: true });
        return toPartnerRequest({
          ...plain,
          requestedAtLabel: timeAgoLabel(b.createdAt),
        });
      }),
    );
  } catch (e) {
    next(e);
  }
}

export async function getEarnings(req, res, next) {
  try {
    const p = recalcPartnerEarnings(await Partner.findByPk(req.partnerId));
    if (!p) return sendFail(res, 'Partner not found', 404);
    return sendOk(res, toEarningsSummary(p));
  } catch (e) {
    next(e);
  }
}

export async function toggleOnline(req, res, next) {
  try {
    const { online } = req.body;
    const p = await Partner.findByPk(req.partnerId);
    if (!p) return sendFail(res, 'Partner not found', 404);
    await p.update({ isOnline: Boolean(online) });
    return sendOk(res, toPartnerProfile(p));
  } catch (e) {
    next(e);
  }
}

export async function acceptRequest(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b || b.partnerStatus !== 'new') return sendFail(res, 'Invalid state', 400);
    b.partnerStatus = 'pending';
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b || b.partnerStatus !== 'new') return sendFail(res, 'Invalid state', 400);
    b.partnerStatus = 'rejected';
    b.userStatus = 'cancelled';
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function startJob(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b || b.partnerStatus !== 'pending') return sendFail(res, 'Invalid state', 400);
    b.partnerStatus = 'in_progress';
    b.userStatus = 'in_progress';
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function completeJob(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b || b.partnerStatus !== 'in_progress') return sendFail(res, 'Invalid state', 400);
    b.partnerStatus = 'completed';
    b.userStatus = 'completed';
    const share = toNum(b.partnerShare);
    const p = await Partner.findByPk(req.partnerId);
    await p.update({
      jobsCompleted: p.jobsCompleted + 1,
      completedJobsCount: (p.completedJobsCount || 0) + 1,
      totalJobsCount: (p.totalJobsCount || 0) + 1,
      todayEarnings: toNum(p.todayEarnings) + share,
      lifetimeEarnings: toNum(p.lifetimeEarnings) + share,
      walletBalance: toNum(p.walletBalance) + share,
    });
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function submitEstimateUpdate(req, res, next) {
  try {
    const n = Math.max(0, Math.floor(parseFloat(String(req.body.newAmount)) || 0));
    if (!n) return sendFail(res, 'newAmount required', 400);
    const b = await bookingForPartner(req);
    if (!b || (b.partnerStatus !== 'in_progress' && b.partnerStatus !== 'pending')) {
      return sendFail(res, 'Invalid state', 400);
    }
    b.pendingEstimateAmount = n;
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function cancelActiveJobWithFee(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b || (b.partnerStatus !== 'pending' && b.partnerStatus !== 'in_progress')) {
      return sendFail(res, 'Cannot cancel this request', 400);
    }
    b.partnerStatus = 'cancelled';
    b.userStatus = 'cancelled';
    await b.save();
    const p = await Partner.findByPk(req.partnerId);
    await p.update({ walletBalance: toNum(p.walletBalance) + PARTNER_ARRIVAL_CANCELLATION_CREDIT });
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function requestHeavyWorkEstimate(req, res, next) {
  try {
    const { extraLabor, materialCost, description } = req.body;
    const b = await bookingForPartner(req);
    if (!b) return sendFail(res, 'Request not found', 404);
    const labor = Number(extraLabor) || 0;
    const material = Number(materialCost) || 0;
    const totalExtra = labor + material;
    b.heavyWorkEstimate = {
      extraLabor: labor,
      materialCost: material,
      totalExtra,
      description: String(description || '').slice(0, 2000),
      requestedAt: new Date().toISOString(),
      status: 'pending_user_approval',
    };
    b.isPartnerArrived = true;
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function declineHeavyWorkEstimate(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b) return sendFail(res, 'Request not found', 404);
    b.partnerStatus = 'cancelled';
    b.userStatus = 'cancelled';
    b.visitingFeePartner = 50;
    if (b.heavyWorkEstimate) {
      b.heavyWorkEstimate = { ...b.heavyWorkEstimate, status: 'declined' };
    }
    await b.save();
    const p = await Partner.findByPk(req.partnerId);
    await p.update({
      walletBalance: toNum(p.walletBalance) + PARTNER_HEAVY_DECLINE_CREDIT,
      todayEarnings: toNum(p.todayEarnings) + PARTNER_HEAVY_DECLINE_CREDIT,
      lifetimeEarnings: toNum(p.lifetimeEarnings) + PARTNER_HEAVY_DECLINE_CREDIT,
    });
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function withdrawBalance(req, res, next) {
  try {
    const p = await Partner.findByPk(req.partnerId);
    if (!p) return sendFail(res, 'Not found', 404);
    await p.update({ walletBalance: 0 });
    return sendOk(res, toEarningsSummary(await p.reload()));
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const p = await Partner.findByPk(req.partnerId);
    if (!p) return sendFail(res, 'Not found', 404);
    const allowed = [
      'name',
      'phone',
      'photoUrl',
      'skills',
      'categories',
      'bankName',
      'bankAccount',
      'primaryCity',
      'serviceInnerRadiusKm',
      'serviceOuterRadiusKm',
      'allowOutOfStation',
    ];
    const upd = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) upd[k] = req.body[k];
    }
    await p.update(upd);
    return sendOk(res, toPartnerProfile(p));
  } catch (e) {
    next(e);
  }
}

export async function getPricingRows(req, res, next) {
  try {
    const rows = await PartnerServicePricing.findAll({ where: { partnerId: req.partnerId } });
    return sendOk(
      res,
      rows.map((r) => ({
        id: r.id,
        serviceName: r.serviceName,
        category: r.category,
        baseCost: toNum(r.baseCost),
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function updatePricingBase(req, res, next) {
  try {
    const n = Math.max(1, parseInt(String(req.body.baseCost), 10));
    const row = await PartnerServicePricing.findOne({
      where: { id: req.params.id, partnerId: req.partnerId },
    });
    if (!row) return sendFail(res, 'Not found', 404);
    await row.update({ baseCost: n });
    return getPricingRows(req, res, next);
  } catch (e) {
    next(e);
  }
}

export async function addPricingRow(req, res, next) {
  try {
    const { serviceName, category, baseCost } = req.body;
    if (!serviceName || !category) return sendFail(res, 'serviceName and category required', 400);
    const price = Math.max(1, parseInt(String(baseCost), 10) || 0);
    if (!price) return sendFail(res, 'baseCost required', 400);
    await PartnerServicePricing.create({
      id: `pp_${Date.now()}_${randomInt(100, 1000)}`,
      partnerId: req.partnerId,
      serviceName,
      category,
      baseCost: price,
    });
    return getPricingRows(req, res, next);
  } catch (e) {
    next(e);
  }
}

async function bookingForPartner(req) {
  return Booking.findOne({ where: { id: req.params.id, partnerId: req.partnerId } });
}

function formatReq(b) {
  return {
    ...b.get({ plain: true }),
    requestedAtLabel: timeAgoLabel(b.createdAt),
  };
}
