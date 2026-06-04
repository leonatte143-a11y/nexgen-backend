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
import { ctrlLog } from '../utils/devLogger.js';
import {
  evaluatePartnerPrice,
  getPartnerPriceLimits,
  mapPricingRow,
} from '../services/partnerPricing.js';
import { loadLineItemsForBookings } from '../services/bookingLines.js';

function recalcPartnerEarnings(p) {
  p.rewardPoints = p.rewardPoints || 0;
  return p;
}

function normalizePartnerPhone(raw) {
  const phone = String(raw || '').replace(/\D/g, '').slice(0, 10);
  return phone.length === 10 ? phone : null;
}

function parseStringList(value) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(Boolean)
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    } catch {
      // ignore invalid JSON and fall back to delimiter split
    }
    return trimmed
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((item) => String(item || '').trim()).filter(Boolean)));
}

function partnerRegistrationFields(body) {
  const explicitCategories = parseStringList(body.categories);
  const serviceCategory = body.serviceCategory ? String(body.serviceCategory).trim() : '';
  const categories = uniqueStrings(
    explicitCategories.length > 0 ? explicitCategories : serviceCategory ? [serviceCategory] : [],
  );
  const primaryCity =
    body.primaryCity ||
    body.workLocation ||
    categories.find((c) => typeof c === 'string' && c.length > 2) ||
    undefined;
  return {
    name: body.name?.trim() || 'Partner',
    skills: uniqueStrings(parseStringList(body.skills)),
    categories,
    primaryCity: primaryCity || 'Rajahmundry',
    bankName: body.bankName || '',
    bankAccount: body.bankAccount || '',
    trainingProgress:
      body.trainingProgress != null ? Math.max(0, Math.min(100, Number(body.trainingProgress) || 0)) : undefined,
    verificationStatus: body.verificationStatus || 'Pending',
  };
}

/**
 * Shared partner create/update for onboarding and auth register routes.
 * @param {{ allowUpdate?: boolean }} opts — when false, existing phone returns 409
 */
export async function upsertPartnerRegistration(body, { allowUpdate = true } = {}) {
  const phone = normalizePartnerPhone(body.phone);
  if (!phone) {
    const err = new Error('Valid 10-digit phone required');
    err.status = 400;
    throw err;
  }
  const id = `partner_${phone}`;
  const fields = partnerRegistrationFields(body);
  const existing = await Partner.findOne({ where: { phone } });
  if (existing && !allowUpdate) {
    const err = new Error('This number is already registered. Use partner login.');
    err.status = 409;
    throw err;
  }
  if (!existing) {
    const p = await Partner.create({
      id,
      phone,
      ...fields,
      verificationStatus: fields.verificationStatus || 'Pending',
    });
    return { partner: p, created: true };
  }
  const upd = {
    name: fields.name || existing.name,
    skills: fields.skills.length ? fields.skills : existing.skills,
    categories: fields.categories.length ? fields.categories : existing.categories,
    bankName: fields.bankName || existing.bankName,
    bankAccount: fields.bankAccount || existing.bankAccount,
    primaryCity: fields.primaryCity || existing.primaryCity,
  };
  if (fields.trainingProgress != null) upd.trainingProgress = fields.trainingProgress;
  await existing.update(upd);
  await existing.reload();
  return { partner: existing, created: false };
}

export async function applyOnboarding(req, res, next) {
  try {
    const { partner, created } = await upsertPartnerRegistration(req.body, { allowUpdate: true });
    ctrlLog('PARTNER', 'applyOnboarding', req, {
      partnerId: partner.id,
      created,
      phoneLast4: partner.phone.slice(-4),
    });
    return sendOk(res, toPartnerProfile(partner), created ? 'Partner registered' : 'Onboarding updated');
  } catch (e) {
    if (e.status && e.message) return sendFail(res, e.message, e.status);
    next(e);
  }
}

export async function getProfile(req, res, next) {
  try {
    const p = await Partner.findByPk(req.partnerId);
    if (!p) return sendFail(res, 'Partner not found', 404);
    ctrlLog('PARTNER', 'getProfile', req);
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
    const lineMap = await loadLineItemsForBookings(rows.map((b) => b.id));
    ctrlLog('PARTNER', 'getRequests', req, { count: rows.length });
    return sendOk(
      res,
      rows.map((b) => {
        const plain = b.get({ plain: true });
        return toPartnerRequest(
          {
            ...plain,
            requestedAtLabel: timeAgoLabel(b.createdAt),
          },
          lineMap.get(b.id) || [],
        );
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
    ctrlLog('PARTNER', 'getEarnings', req);
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
    await p.reload();
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
    await p.reload();
    return sendOk(res, toPartnerProfile(p));
  } catch (e) {
    next(e);
  }
}

export async function getPricingLimits(req, res, next) {
  try {
    const limits = await getPartnerPriceLimits();
    return sendOk(res, limits);
  } catch (e) {
    next(e);
  }
}

export async function getPricingRows(req, res, next) {
  try {
    const limits = await getPartnerPriceLimits();
    const rows = await PartnerServicePricing.findAll({
      where: { partnerId: req.partnerId },
      order: [['serviceName', 'ASC']],
    });
    return sendOk(res, {
      limits,
      items: rows.map((r) => mapPricingRow(r, limits)),
    });
  } catch (e) {
    next(e);
  }
}

export async function updatePricingRow(req, res, next) {
  try {
    const limits = await getPartnerPriceLimits();
    const row = await PartnerServicePricing.findOne({
      where: { id: req.params.id, partnerId: req.partnerId },
    });
    if (!row) return sendFail(res, 'Not found', 404);

    const updates = {};
    if (req.body.serviceName !== undefined) {
      const name = String(req.body.serviceName).trim();
      if (!name) return sendFail(res, 'Service name is required', 400);
      updates.serviceName = name;
    }
    if (req.body.category !== undefined) {
      updates.category = String(req.body.category).trim();
    }
    if (req.body.baseCost !== undefined) {
      const newPrice = Math.round(Number(req.body.baseCost));
      const evalResult = evaluatePartnerPrice(newPrice, limits);
      if (newPrice !== toNum(row.baseCost)) {
        updates.previousBaseCost = toNum(row.baseCost);
      }
      updates.baseCost = newPrice;
      updates.approvalStatus = evalResult.approvalStatus;
      if (!evalResult.ok) {
        updates.isActive = false;
      } else if (row.approvalStatus === 'rejected') {
        updates.approvalStatus = 'approved';
      }
    }
    if (req.body.isActive !== undefined) {
      const wantActive = Boolean(req.body.isActive);
      if (wantActive && row.approvalStatus === 'pending_review') {
        return sendFail(res, 'Cannot activate until admin approves this price', 400);
      }
      updates.isActive = wantActive;
    }

    await row.update(updates);
    await row.reload();

    const payload = mapPricingRow(row, limits);
    const message =
      row.approvalStatus === 'pending_review'
        ? `Price submitted for admin review (allowed range ₹${limits.min}–₹${limits.max}).`
        : 'Service updated';

    return sendOk(res, { ...payload, items: (await listPricingItems(req.partnerId, limits)) }, message);
  } catch (e) {
    next(e);
  }
}

/** @deprecated alias — mobile may still call PUT with baseCost only */
export async function updatePricingBase(req, res, next) {
  return updatePricingRow(req, res, next);
}

export async function addPricingRow(req, res, next) {
  try {
    const limits = await getPartnerPriceLimits();
    const { serviceName, category, baseCost } = req.body;
    if (!serviceName?.trim()) return sendFail(res, 'serviceName required', 400);
    const price = Math.round(Number(baseCost));
    const evalResult = evaluatePartnerPrice(price, limits);
    if (!price) return sendFail(res, 'baseCost required', 400);

    const row = await PartnerServicePricing.create({
      id: `pp_${Date.now()}_${randomInt(100, 1000)}`,
      partnerId: req.partnerId,
      serviceName: String(serviceName).trim(),
      category: String(category || 'General').trim(),
      baseCost: price,
      isActive: evalResult.ok,
      approvalStatus: evalResult.approvalStatus,
    });

    const message = evalResult.ok
      ? 'Service added'
      : evalResult.message || 'Submitted for admin review';

    return sendOk(
      res,
      {
        item: mapPricingRow(row, limits),
        items: await listPricingItems(req.partnerId, limits),
      },
      message,
    );
  } catch (e) {
    next(e);
  }
}

export async function deletePricingRow(req, res, next) {
  try {
    const limits = await getPartnerPriceLimits();
    const row = await PartnerServicePricing.findOne({
      where: { id: req.params.id, partnerId: req.partnerId },
    });
    if (!row) return sendFail(res, 'Not found', 404);
    await row.destroy();
    return sendOk(res, { items: await listPricingItems(req.partnerId, limits) }, 'Service removed');
  } catch (e) {
    next(e);
  }
}

async function listPricingItems(partnerId, limits) {
  const rows = await PartnerServicePricing.findAll({
    where: { partnerId },
    order: [['serviceName', 'ASC']],
  });
  return rows.map((r) => mapPricingRow(r, limits));
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
