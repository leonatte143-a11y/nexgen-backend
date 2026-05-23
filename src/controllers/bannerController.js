import { randomUUID } from 'crypto';
import { AdvertisementBanner } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toBannerDto } from '../serializers/bannerMapper.js';
import { buildActiveBannerWhere } from '../services/bannerQuery.js';
import { validateBannerPayload } from '../utils/bannerValidation.js';

async function fetchActiveBanners(city, limit = 20) {
  const rows = await AdvertisementBanner.findAll({
    where: buildActiveBannerWhere(city),
    order: [
      ['priority', 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit: Math.min(Math.max(Number(limit) || 20, 1), 50),
  });
  return rows.map(toBannerDto);
}

export async function listBanners(req, res, next) {
  try {
    const city = req.query.city;
    const limit = req.query.limit;
    const data = await fetchActiveBanners(city, limit);
    return sendOk(res, data);
  } catch (e) {
    next(e);
  }
}

export async function listHomeBanners(req, res, next) {
  try {
    const city = req.query.city;
    const data = await fetchActiveBanners(city, 10);
    return sendOk(res, data);
  } catch (e) {
    next(e);
  }
}

export async function adminListBanners(req, res, next) {
  try {
    const rows = await AdvertisementBanner.findAll({
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC'],
      ],
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
    const row = await AdvertisementBanner.create({
      id: b.id?.trim() || `banner_${randomUUID().slice(0, 8)}`,
      title: String(b.title).trim(),
      subtitle: b.subtitle?.trim() || null,
      imageUrl: b.imageUrl?.trim() || null,
      ctaText: (b.ctaText?.trim() || 'Book Now').slice(0, 80),
      redirectType: b.redirectType || 'none',
      redirectValue: b.redirectValue?.trim() || null,
      city: b.city?.trim() || null,
      isActive: b.isActive !== false && b.isActive !== 0,
      priority: Number(b.priority) || 0,
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      createdBy: req.adminId || null,
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
    if (b.ctaText !== undefined) patch.ctaText = (b.ctaText?.trim() || 'Book Now').slice(0, 80);
    if (b.redirectType !== undefined) patch.redirectType = b.redirectType;
    if (b.redirectValue !== undefined) patch.redirectValue = b.redirectValue?.trim() || null;
    if (b.city !== undefined) patch.city = b.city?.trim() || null;
    if (b.isActive !== undefined) patch.isActive = !!(b.isActive === true || b.isActive === 1);
    if (b.priority !== undefined) patch.priority = Number(b.priority) || 0;
    if (b.startDate !== undefined) patch.startDate = b.startDate ? new Date(b.startDate) : null;
    if (b.endDate !== undefined) patch.endDate = b.endDate ? new Date(b.endDate) : null;

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
