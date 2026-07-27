import { randomUUID } from 'crypto';
import { MarketplaceCategory, MarketplaceListing, MarketplaceReport, User, Partner } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { haversineKm } from '../utils/haversine.js';
import { toNum } from '../serializers/formatters.js';
import { bumpCategorySearch, slugify } from '../services/trendingCategoryService.js';

const LISTING_TYPES = ['rent', 'sell', 'resale'];

async function resolveMarketplaceCategory({ categoryId, categoryName }) {
  if (categoryId) {
    const existing = await MarketplaceCategory.findByPk(String(categoryId));
    if (existing) return existing;
  }
  const name = String(categoryName || categoryId || '').trim();
  if (!name) return null;
  const id = slugify(name) || `mcat_${Date.now()}`;
  const [cat] = await MarketplaceCategory.findOrCreate({
    where: { id },
    defaults: { id, name, isActive: true },
  });
  await bumpCategorySearch(name);
  return cat;
}

function toListingDto(row, distanceKm) {
  return {
    id: row.id,
    sellerRole: row.sellerRole,
    sellerId: row.sellerId,
    listingType: row.listingType,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description || '',
    photos: Array.isArray(row.photos) ? row.photos : [],
    price: row.price != null ? toNum(row.price) : null,
    depositAmount: row.depositAmount != null ? toNum(row.depositAmount) : null,
    rentPricePerDay: row.rentPricePerDay != null ? toNum(row.rentPricePerDay) : null,
    city: row.city,
    latitude: row.latitude != null ? toNum(row.latitude) : null,
    longitude: row.longitude != null ? toNum(row.longitude) : null,
    status: row.status,
    distanceKm: distanceKm != null ? distanceKm : null,
    createdAt: row.createdAt,
  };
}

export async function listCategories(_req, res, next) {
  try {
    const rows = await MarketplaceCategory.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
    return sendOk(res, rows.map((c) => ({ id: c.id, name: c.name })));
  } catch (e) {
    next(e);
  }
}

export async function listListings(req, res, next) {
  try {
    const { listingType, categoryId, city, q } = req.query;
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;

    if (q) await bumpCategorySearch(String(q)).catch(() => {});

    const where = { status: 'active' };
    if (listingType && LISTING_TYPES.includes(String(listingType))) where.listingType = listingType;
    if (categoryId) where.categoryId = categoryId;
    if (city) where.city = city;

    const rows = await MarketplaceListing.findAll({ where, order: [['createdAt', 'DESC']] });

    let filtered = rows;
    if (q) {
      const needle = String(q).trim().toLowerCase();
      filtered = rows.filter(
        (r) => r.title.toLowerCase().includes(needle) || String(r.description || '').toLowerCase().includes(needle),
      );
    }

    const withDistance = filtered.map((row) => {
      const hasCoords = lat != null && lng != null && row.latitude != null && row.longitude != null;
      const distanceKm = hasCoords ? haversineKm(lat, lng, toNum(row.latitude), toNum(row.longitude)) : null;
      return { row, distanceKm };
    });

    // Proximity-first sort: closest listings surface first (falls back to newest when no coords).
    withDistance.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      if (a.distanceKm != null) return -1;
      if (b.distanceKm != null) return 1;
      return 0;
    });

    return sendOk(res, withDistance.map(({ row, distanceKm }) => toListingDto(row, distanceKm)));
  } catch (e) {
    next(e);
  }
}

export async function getListing(req, res, next) {
  try {
    const row = await MarketplaceListing.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Listing not found', 404);
    return sendOk(res, toListingDto(row));
  } catch (e) {
    next(e);
  }
}

export async function createListing(req, res, next) {
  try {
    const b = req.body || {};
    const listingType = LISTING_TYPES.includes(String(b.listingType)) ? b.listingType : 'sell';
    if (!String(b.title || '').trim()) return sendFail(res, 'title is required', 400);

    const cat = await resolveMarketplaceCategory({ categoryId: b.categoryId, categoryName: b.categoryName });
    if (!cat) return sendFail(res, 'category is required', 400);

    if (listingType === 'rent' && !(Number(b.depositAmount) > 0)) {
      return sendFail(res, 'depositAmount is required for rental listings', 400);
    }
    if (listingType !== 'rent' && !(Number(b.price) > 0)) {
      return sendFail(res, 'price is required', 400);
    }

    let contactPhone = b.contactPhone;
    if (!contactPhone) {
      if (req.sellerRole === 'user') {
        const u = await User.findByPk(req.sellerId);
        contactPhone = u?.phone;
      } else {
        const p = await Partner.findByPk(req.sellerId);
        contactPhone = p?.phone;
      }
    }

    const row = await MarketplaceListing.create({
      id: `mlist_${randomUUID().slice(0, 10)}`,
      sellerRole: req.sellerRole,
      sellerId: req.sellerId,
      listingType,
      categoryId: cat.id,
      title: String(b.title).trim().slice(0, 200),
      description: String(b.description || '').slice(0, 2000),
      photos: Array.isArray(b.photos) ? b.photos.slice(0, 6) : [],
      price: listingType === 'rent' ? null : Number(b.price) || null,
      depositAmount: listingType === 'rent' ? Number(b.depositAmount) || null : null,
      rentPricePerDay: listingType === 'rent' ? Number(b.rentPricePerDay) || null : null,
      city: b.city || null,
      latitude: b.latitude != null ? Number(b.latitude) : null,
      longitude: b.longitude != null ? Number(b.longitude) : null,
      contactPhone: contactPhone || null,
      status: 'active',
    });

    return sendOk(res, toListingDto(row), 'Listing posted', 201);
  } catch (e) {
    next(e);
  }
}

export async function listMyListings(req, res, next) {
  try {
    const rows = await MarketplaceListing.findAll({
      where: { sellerRole: req.sellerRole, sellerId: req.sellerId },
      order: [['createdAt', 'DESC']],
    });
    return sendOk(res, rows.map((r) => toListingDto(r)));
  } catch (e) {
    next(e);
  }
}

export async function reportListing(req, res, next) {
  try {
    const listing = await MarketplaceListing.findByPk(req.params.id);
    if (!listing) return sendFail(res, 'Listing not found', 404);
    await MarketplaceReport.create({
      id: `mrep_${randomUUID().slice(0, 10)}`,
      listingId: listing.id,
      reporterRole: req.sellerRole,
      reporterId: req.sellerId,
      reason: String(req.body?.reason || '').slice(0, 500) || null,
    });
    return sendOk(res, { ok: true }, 'Report submitted — our team will review this listing');
  } catch (e) {
    next(e);
  }
}
