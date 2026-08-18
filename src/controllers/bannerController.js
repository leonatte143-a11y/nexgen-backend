import { randomUUID } from 'crypto';
import { AdvertisementBanner } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toBannerDto } from '../serializers/bannerMapper.js';
import { buildActiveBannerWhere } from '../services/bannerQuery.js';
import { BANNER_QUEUE_ORDER, nextDisplayOrder } from '../services/bannerQueueService.js';
import { validateBannerPayload, isValidMediaUrl } from '../utils/bannerValidation.js';
import { isPointInPolygon } from '../utils/geoFence.js';

function parseCoords(req) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

async function fetchActiveBanners(city, limit = 20, placement, coords) {
  const rows = await AdvertisementBanner.findAll({
    where: buildActiveBannerWhere(city, placement),
    order: BANNER_QUEUE_ORDER,
    limit: Math.min(Math.max(Number(limit) || 20, 1), 50),
  });
  const filtered = rows.filter((row) => {
    const fence = row.geoFence;
    if (!Array.isArray(fence) || fence.length < 3) return true;
    if (!coords) return false;
    return isPointInPolygon(coords, fence);
  });
  return filtered.map(toBannerDto);
}

export async function listBanners(req, res, next) {
  try {
    const city = req.query.city;
    const limit = req.query.limit;
    const data = await fetchActiveBanners(city, limit, undefined, parseCoords(req));
    return sendOk(res, data);
  } catch (e) {
    next(e);
  }
}

export async function listHomeBanners(req, res, next) {
  try {
    const city = req.query.city;
    const placement = req.query.placement || 'home_dashboard';
    const data = await fetchActiveBanners(city, 10, placement, parseCoords(req));
    return sendOk(res, data);
  } catch (e) {
    next(e);
  }
}

export async function adminListBanners(req, res, next) {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    const rows = await AdvertisementBanner.findAll({
      where,
      order: BANNER_QUEUE_ORDER,
    });
    return sendOk(res, rows.map(toBannerDto));
  } catch (e) {
    next(e);
  }
}

export async function adminCreateBanner(req, res, next) {
  try {
    const errors = validateBannerPayload(req.body);
    if (errors.length) return sendFail(res, errors.join('; '), 400);

    const b = req.body;
    const placement = b.placement || 'home_dashboard';
    const displayOrder =
      b.displayOrder != null && Number.isFinite(Number(b.displayOrder))
        ? Number(b.displayOrder)
        : await nextDisplayOrder(placement);
    const row = await AdvertisementBanner.create({
      id: b.id?.trim() || `banner_${randomUUID().slice(0, 8)}`,
      title: String(b.title).trim(),
      subtitle: b.subtitle?.trim() || null,
      imageUrl: b.imageUrl?.trim() || null,
      mediaType: (b.mediaType || 'image').toLowerCase() === 'video' ? 'video' : 'image',
      placement,
      ctaText: (b.ctaText?.trim() || 'Book Now').slice(0, 80),
      redirectType: b.redirectType || 'none',
      redirectValue: b.redirectValue?.trim() || null,
      city: b.city?.trim() || null,
      isActive: b.isActive !== false && b.isActive !== 0,
      priority: Number(b.priority) || 0,
      displayOrder,
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      createdBy: req.adminId || null,
      geoFence: Array.isArray(b.geoFence) && b.geoFence.length >= 3 ? b.geoFence : null,
    });
    return sendOk(res, toBannerDto(row), 'Banner created', 201);
  } catch (e) {
    next(e);
  }
}

export async function adminUpdateBanner(req, res, next) {
  try {
    const row = await AdvertisementBanner.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Banner not found', 404);

    const errors = validateBannerPayload(req.body, { partial: true });
    if (errors.length) return sendFail(res, errors.join('; '), 400);

    const b = req.body;
    const patch = {};
    if (b.title !== undefined) patch.title = String(b.title).trim();
    if (b.subtitle !== undefined) patch.subtitle = b.subtitle?.trim() || null;
    if (b.imageUrl !== undefined) patch.imageUrl = b.imageUrl?.trim() || null;
    if (b.mediaType !== undefined) {
      patch.mediaType = String(b.mediaType).toLowerCase() === 'video' ? 'video' : 'image';
    }
    if (b.placement !== undefined) patch.placement = b.placement || 'home_dashboard';
    if (b.ctaText !== undefined) patch.ctaText = (b.ctaText?.trim() || 'Book Now').slice(0, 80);
    if (b.redirectType !== undefined) patch.redirectType = b.redirectType;
    if (b.redirectValue !== undefined) patch.redirectValue = b.redirectValue?.trim() || null;
    if (b.city !== undefined) patch.city = b.city?.trim() || null;
    if (b.isActive !== undefined) patch.isActive = !!(b.isActive === true || b.isActive === 1);
    if (b.priority !== undefined) patch.priority = Number(b.priority) || 0;
    if (b.displayOrder !== undefined) patch.displayOrder = Number(b.displayOrder) || 0;
    if (b.startDate !== undefined) patch.startDate = b.startDate ? new Date(b.startDate) : null;
    if (b.endDate !== undefined) patch.endDate = b.endDate ? new Date(b.endDate) : null;
    if (b.geoFence !== undefined) {
      patch.geoFence = Array.isArray(b.geoFence) && b.geoFence.length >= 3 ? b.geoFence : null;
    }

    await row.update(patch);
    return sendOk(res, toBannerDto(row), 'Banner updated');
  } catch (e) {
    next(e);
  }
}

export async function adminDeleteBanner(req, res, next) {
  try {
    const row = await AdvertisementBanner.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Banner not found', 404);
    await row.destroy();
    return sendOk(res, { id: req.params.id }, 'Banner deleted');
  } catch (e) {
    next(e);
  }
}

export async function adminApproveBanner(req, res, next) {
  try {
    const row = await AdvertisementBanner.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Banner not found', 404);
    await row.update({ status: 'approved', isActive: true, reviewNote: null });
    return sendOk(res, toBannerDto(row), 'Ad approved');
  } catch (e) {
    next(e);
  }
}

export async function adminRejectBanner(req, res, next) {
  try {
    const row = await AdvertisementBanner.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Banner not found', 404);
    const reviewNote = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : null;
    await row.update({ status: 'rejected', isActive: false, reviewNote });
    return sendOk(res, toBannerDto(row), 'Ad rejected');
  } catch (e) {
    next(e);
  }
}

// A base64 data URL is ~33% larger than the underlying image, so cap the raw payload well
// under a sane image size to fail fast with a clear 400 instead of a confusing DB error.
const MAX_IMAGE_DATA_URL_LENGTH = 8 * 1024 * 1024; // ~6MB of actual image data

/** Shared create logic for both the Partner- and User-facing "Advertise your business"
 * submission endpoints — only who owns the row (partnerId vs userId) differs. */
async function createAdRequest(req, res, next, owner) {
  try {
    const b = req.body || {};
    const title = String(b.businessName || b.title || '').trim();
    if (!title) return sendFail(res, 'businessName is required', 400);

    const imageUrl = b.imageUrl?.trim() || null;
    if (!imageUrl || !isValidMediaUrl(imageUrl)) {
      return sendFail(res, 'imageUrl must be a valid http(s) URL or image/video data URL', 400);
    }
    if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return sendFail(res, 'Image is too large. Please choose a smaller photo.', 400);
    }

    const startDate = b.startDate ? new Date(b.startDate) : new Date();
    const endDate = b.endDate ? new Date(b.endDate) : null;
    if (b.endDate && Number.isNaN(endDate?.getTime())) {
      return sendFail(res, 'endDate must be a valid date', 400);
    }

    const placement = b.placement || 'home_dashboard';
    const displayOrder = await nextDisplayOrder(placement);

    const row = await AdvertisementBanner.create({
      id: `banner_${randomUUID().slice(0, 8)}`,
      title,
      subtitle: b.subtitle?.trim() || b.businessAddress?.trim() || null,
      imageUrl,
      mediaType: (b.mediaType || 'image').toLowerCase() === 'video' ? 'video' : 'image',
      placement,
      ctaText: 'Learn more',
      redirectType: b.redirectValue ? 'external' : 'none',
      redirectValue: b.redirectValue?.trim() || null,
      city: b.city?.trim() || null,
      isActive: true,
      priority: 0,
      displayOrder,
      startDate,
      endDate,
      createdBy: owner.partnerId || owner.userId || null,
      partnerId: owner.partnerId || null,
      userId: owner.userId || null,
      status: 'approved',
    });
    return sendOk(res, toBannerDto(row), 'Your ad is live', 201);
  } catch (e) {
    next(e);
  }
}

/** Partner-facing: submit a business ad for admin approval. Mirrors the "Advertise your
 * business" mobile flow (business details + banner image + plan duration -> pending ad row). */
export async function createPartnerAdRequest(req, res, next) {
  return createAdRequest(req, res, next, { partnerId: req.partnerId });
}

/** User-facing equivalent of createPartnerAdRequest — the "Advertise your business" entry
 * point lives in the User App's Profile menu, so Users need their own path to submit one. */
export async function createUserAdRequest(req, res, next) {
  return createAdRequest(req, res, next, { userId: req.userId });
}

/** Partner-facing: list ads this partner has submitted, newest first, so they can track
 * approval status from the mobile "My Ads" screen. */
export async function listMyAdRequests(req, res, next) {
  try {
    const rows = await AdvertisementBanner.findAll({
      where: { partnerId: req.partnerId },
      order: [['createdAt', 'DESC']],
    });
    return sendOk(res, rows.map(toBannerDto));
  } catch (e) {
    next(e);
  }
}

/** User-facing equivalent of listMyAdRequests. */
export async function listMyUserAdRequests(req, res, next) {
  try {
    const rows = await AdvertisementBanner.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
    });
    return sendOk(res, rows.map(toBannerDto));
  } catch (e) {
    next(e);
  }
}
