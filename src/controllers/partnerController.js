import { randomInt, randomUUID } from 'crypto';
import { Partner, Booking, PartnerServicePricing, User, PayoutQueue, PartnerReferralEarning } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { ensurePartnerReferralCode, findReferrerPartnerByCode } from '../utils/referralCode.js';
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
  getPartnerPriceLimitsPayload,
  mapPricingRow,
} from '../services/partnerPricing.js';
import { loadLineItemsForBookings } from '../services/bookingLines.js';

function genOtp() {
  return String(randomInt(1000, 10000));
}

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
    idType: body.idType ? String(body.idType).trim() : undefined,
    idNumber: body.idNumber ? String(body.idNumber).trim() : undefined,
    pincode: body.pincode ? String(body.pincode).trim() : undefined,
    customCategoryRequest: body.customCategory
      ? String(body.customCategory).trim()
      : body.customCategoryRequest
        ? String(body.customCategoryRequest).trim()
        : undefined,
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
    const referrer = await findReferrerPartnerByCode(body.referralCode, id);
    const p = await Partner.create({
      id,
      phone,
      ...fields,
      verificationStatus: fields.verificationStatus || 'Pending',
      referredByPartnerId: referrer?.id || null,
    });
    await ensurePartnerReferralCode(p);
    return { partner: p, created: true };
  }
  const upd = {
    name: fields.name || existing.name,
    skills: fields.skills.length ? fields.skills : existing.skills,
    categories: fields.categories.length ? fields.categories : existing.categories,
    bankName: fields.bankName || existing.bankName,
    bankAccount: fields.bankAccount || existing.bankAccount,
    primaryCity: fields.primaryCity || existing.primaryCity,
    idType: fields.idType || existing.idType,
    idNumber: fields.idNumber || existing.idNumber,
    pincode: fields.pincode || existing.pincode,
    customCategoryRequest: fields.customCategoryRequest || existing.customCategoryRequest,
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
    await ensurePartnerReferralCode(p);
    ctrlLog('PARTNER', 'getProfile', req);
    return sendOk(res, toPartnerProfile(p));
  } catch (e) {
    next(e);
  }
}

export async function getReferralEarnings(req, res, next) {
  try {
    const p = await Partner.findByPk(req.partnerId);
    if (!p) return sendFail(res, 'Partner not found', 404);
    await ensurePartnerReferralCode(p);
    const rows = await PartnerReferralEarning.findAll({
      where: { referrerPartnerId: req.partnerId },
      order: [['createdAt', 'DESC']],
    });
    const totalEarned = rows.reduce((sum, r) => sum + toNum(r.amount), 0);
    return sendOk(res, {
      referralCode: p.referralCode,
      totalEarned,
      earnings: rows.map((r) => ({
        id: r.id,
        bookingId: r.bookingId,
        amount: toNum(r.amount),
        createdAt: r.createdAt,
      })),
    });
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
    const userIds = [...new Set(rows.map((b) => b.userId))];
    const users = userIds.length ? await User.findAll({ where: { id: userIds } }) : [];
    const phoneByUser = new Map(users.map((u) => [u.id, u.phone]));
    ctrlLog('PARTNER', 'getRequests', req, { count: rows.length });
    return sendOk(
      res,
      rows.map((b) => {
        const plain = b.get({ plain: true });
        return toPartnerRequest(
          {
            ...plain,
            requestedAtLabel: timeAgoLabel(b.createdAt),
            customerPhone: phoneByUser.get(b.userId) || null,
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

export async function markArrived(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b) return sendFail(res, 'Request not found', 404);
    if (b.partnerStatus === 'in_progress') return sendOk(res, toPartnerRequest(formatReq(b)));
    if (b.partnerStatus !== 'pending') return sendFail(res, 'Invalid state', 400);
    b.isPartnerArrived = true;
    b.partnerStatus = 'in_progress';
    b.userStatus = 'in_progress';
    b.startOtp = null;
    b.endOtp = null;
    b.workDoneRequested = false;
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

/** @deprecated Start OTP removed — arrive auto-starts the job. Kept for backward-compatible clients. */
export async function startJob(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b) return sendFail(res, 'Request not found', 404);
    if (b.partnerStatus === 'in_progress') return sendOk(res, toPartnerRequest(formatReq(b)));
    if (b.partnerStatus !== 'pending' || !b.isPartnerArrived) {
      return sendFail(res, 'Invalid state', 400);
    }
    b.partnerStatus = 'in_progress';
    b.userStatus = 'in_progress';
    b.startOtp = null;
    b.workDoneRequested = false;
    b.endOtp = null;
    await b.save();
    return sendOk(res, toPartnerRequest(formatReq(b)));
  } catch (e) {
    next(e);
  }
}

export async function markWorkDone(req, res, next) {
  try {
    const b = await bookingForPartner(req);
    if (!b || b.partnerStatus !== 'in_progress') return sendFail(res, 'Invalid state', 400);
    if (b.workDoneRequested) return sendOk(res, toPartnerRequest(formatReq(b)));
    b.workDoneRequested = true;
    b.endOtp = genOtp();
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
    if (!b.workDoneRequested) return sendFail(res, 'Tap Work Done before entering completion OTP', 400);
    const otp = String(req.body?.otp || req.body?.endOtp || '').trim();
    if (!otp || otp !== String(b.endOtp)) return sendFail(res, 'Invalid completion OTP', 400);
    b.partnerStatus = 'completed';
    b.userStatus = 'completed';
    b.endOtp = null;
    b.startOtp = null;
    b.workDoneRequested = false;
    b.paymentStatus = 'pending';
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
    const balance = toNum(p.walletBalance);
    if (balance <= 0) return sendFail(res, 'No balance available to withdraw', 400);
    const pending = await PayoutQueue.findOne({
      where: { partnerId: p.id, status: 'pending' },
    });
    if (pending) return sendFail(res, 'A withdrawal request is already pending admin approval', 400);
    const id = `pq_${randomUUID().slice(0, 10)}`;
    await PayoutQueue.create({
      id,
      partnerId: p.id,
      amount: balance,
      bankName: p.bankName,
      bankAccount: p.bankAccount,
      status: 'pending',
      weekLabel: `withdraw_${new Date().toISOString().slice(0, 10)}`,
    });
    await p.update({ walletBalance: 0 });
    return sendOk(res, toEarningsSummary(await p.reload()), 'Withdrawal submitted for admin approval');
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
      'photos',
      'skills',
      'categories',
      'bankName',
      'bankAccount',
      'primaryCity',
      'serviceInnerRadiusKm',
      'serviceOuterRadiusKm',
      'allowOutOfStation',
      'description',
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

/** Partner-initiated account deletion: soft-deletes (archives) the partner's own account
 * rather than hard-deleting the row, preserving booking history integrity. Mirrors the
 * admin archivePartner soft-delete pattern (accountStatus/archivedAt), scoped to req.partnerId. */
export async function deleteAccount(req, res, next) {
  try {
    const p = await Partner.findByPk(req.partnerId);
    if (!p) return sendFail(res, 'Partner not found', 404);
    await p.update({ archivedAt: new Date(), accountStatus: 'archived', isOnline: false });
    return sendOk(res, { id: p.id }, 'Account deleted');
  } catch (e) {
    next(e);
  }
}

export async function getPricingLimits(req, res, next) {
  try {
    const category = req.query.category;
    const limits = category
      ? await getPartnerPriceLimits(category)
      : await getPartnerPriceLimitsPayload();
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
    const row = await PartnerServicePricing.findOne({
      where: { id: req.params.id, partnerId: req.partnerId },
    });
    if (!row) return sendFail(res, 'Not found', 404);
    const limits = await getPartnerPriceLimits(row.category);

    const updates = {};
    if (req.body.serviceName !== undefined) {
      const name = String(req.body.serviceName).trim();
      if (!name) return sendFail(res, 'Service name is required', 400);
      updates.serviceName = name;
    }
    if (req.body.category !== undefined) {
      updates.category = String(req.body.category).trim();
    }
    const limitCategory = updates.category ?? row.category;
    const rowLimits = await getPartnerPriceLimits(limitCategory);
    if (req.body.baseCost !== undefined) {
      const newPrice = Math.round(Number(req.body.baseCost));
      const evalResult = evaluatePartnerPrice(newPrice, rowLimits);
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

    const payload = mapPricingRow(row, rowLimits);
    const message =
      row.approvalStatus === 'pending_review'
        ? `Price submitted for admin review (allowed range ₹${rowLimits.min}–₹${rowLimits.max}).`
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
    const { serviceName, category, baseCost } = req.body;
    if (!serviceName?.trim()) return sendFail(res, 'serviceName required', 400);
    const limits = await getPartnerPriceLimits(category);
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
