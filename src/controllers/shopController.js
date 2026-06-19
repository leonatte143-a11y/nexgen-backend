import { randomUUID } from 'crypto';
import { Shop, ShopCategory, Partner } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import {
  defaultCoords,
  enrichShopRow,
  findPartnerNearbyShop,
  recommendedCategoryIdsForUser,
} from '../services/shopDiscovery.js';
import { bumpCategorySearch, getTrendingSuggestions, slugify } from '../services/trendingCategoryService.js';
import { haversineKm } from '../utils/haversine.js';
import { toNum } from '../serializers/formatters.js';

function sortShops(rows) {
  return rows.sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    const da = a.distanceKm ?? 999;
    const db = b.distanceKm ?? 999;
    return da - db;
  });
}

function normalizeLeadPreference(raw) {
  const v = String(raw || '').toLowerCase();
  if (v === 'local' || v === 'offline') return 'local';
  if (v === 'regional' || v === 'online') return 'regional';
  return 'local';
}

export async function listCategories(_req, res, next) {
  try {
    const rows = await ShopCategory.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
    });
    return sendOk(res, rows.map((c) => ({ id: c.id, name: c.name })));
  } catch (e) {
    next(e);
  }
}

export async function listNearby(req, res, next) {
  try {
    const { lat: uLat, lng: uLng } = defaultCoords(req.query.lat, req.query.lng);
    const radiusKm = Math.min(20, Math.max(1, parseFloat(String(req.query.radiusKm)) || 10));
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q) await bumpCategorySearch(q).catch(() => {});
    const categoryId = String(req.query.categoryId || '').trim() || null;
    const userId = req.userId || null;

    const categories = await ShopCategory.findAll();
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const shops = await Shop.findAll({
      where: { verificationStatus: 'verified', isActive: true },
    });

    const recommendedIds = await recommendedCategoryIdsForUser(userId);

    const enriched = [];
    for (const shop of shops) {
      const category = catMap.get(shop.categoryId);
      if (categoryId && shop.categoryId !== categoryId) continue;
      if (q) {
        const hay = `${shop.shopName} ${shop.searchKeywords || ''} ${category?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const shopLat = toNum(shop.latitude);
      const shopLng = toNum(shop.longitude);
      if (shopLat && shopLng) {
        const dist = haversineKm(uLat, uLng, shopLat, shopLng);
        if (dist > radiusKm) continue;
      }
      const nearbyPartner = await findPartnerNearbyShop(shopLat, shopLng);
      const row = enrichShopRow(shop, category, uLat, uLng, nearbyPartner);
      row.nearbyPartnerName = nearbyPartner?.name || null;
      enriched.push(row);
    }

    const sorted = sortShops(enriched);
    const featured = sorted.filter((s) => s.isFeatured);
    const recommended =
      recommendedIds.length > 0
        ? sorted.filter((s) => recommendedIds.includes(s.categoryId)).slice(0, 3)
        : [];

    return sendOk(res, {
      featured,
      recommended,
      items: sorted,
      total: sorted.length,
      recommendedForJob: recommended.length > 0,
    });
  } catch (e) {
    next(e);
  }
}

export async function getShop(req, res, next) {
  try {
    const shop = await Shop.findByPk(req.params.id, {
      include: [{ model: ShopCategory, as: 'category' }],
    });
    if (!shop || shop.verificationStatus !== 'verified' || !shop.isActive) {
      return sendFail(res, 'Shop not found', 404);
    }
    const { lat: uLat, lng: uLng } = defaultCoords(req.query.lat, req.query.lng);
    const shopLat = toNum(shop.latitude);
    const shopLng = toNum(shop.longitude);
    const nearbyPartner = await findPartnerNearbyShop(shopLat, shopLng);
    const payload = enrichShopRow(shop, shop.category, uLat, uLng, nearbyPartner);
    payload.nearbyPartnerName = nearbyPartner?.name || null;
    payload.gstOrLicense = shop.gstOrLicense || null;
    return sendOk(res, payload);
  } catch (e) {
    next(e);
  }
}

export async function trackCall(req, res, next) {
  try {
    const shop = await Shop.findByPk(req.params.id);
    if (!shop) return sendFail(res, 'Shop not found', 404);
    await shop.update({
      callCount: (shop.callCount || 0) + 1,
      clickCount: (shop.clickCount || 0) + 1,
    });
    return sendOk(res, { callCount: shop.callCount + 1 });
  } catch (e) {
    next(e);
  }
}

export async function trackDirections(req, res, next) {
  try {
    const shop = await Shop.findByPk(req.params.id);
    if (!shop) return sendFail(res, 'Shop not found', 404);
    await shop.update({
      directionsCount: (shop.directionsCount || 0) + 1,
      clickCount: (shop.clickCount || 0) + 1,
    });
    return sendOk(res, { directionsCount: shop.directionsCount + 1 });
  } catch (e) {
    next(e);
  }
}

export async function trendingSuggestions(_req, res, next) {
  try {
    const trending = await getTrendingSuggestions(5);
    const staticCats = await ShopCategory.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
    const seen = new Set(trending.map((t) => t.id));
    const merged = [
      ...trending,
      ...staticCats.filter((c) => !seen.has(c.id)).map((c) => ({ id: c.id, name: c.name, searchCount: 0 })),
    ];
    return sendOk(res, merged.slice(0, 12));
  } catch (e) {
    next(e);
  }
}

async function resolveShopCategory({ categoryId, categoryName }) {
  if (categoryId) {
    const existing = await ShopCategory.findByPk(String(categoryId));
    if (existing) return existing;
  }
  const name = String(categoryName || categoryId || '').trim();
  if (!name) return null;
  const id = slugify(name) || `cat_${Date.now()}`;
  const [cat] = await ShopCategory.findOrCreate({
    where: { id },
    defaults: { id, name, isActive: true },
  });
  if (cat.name !== name) await cat.update({ name });
  await bumpCategorySearch(name);
  return cat;
}

export async function applyShop(req, res, next) {
  try {
    const {
      shopName,
      ownerName,
      categoryId,
      categoryName,
      phone,
      address,
      city,
      latitude,
      longitude,
      gstOrLicense,
      leadPreference,
    } = req.body;
    if (!shopName?.trim()) return sendFail(res, 'Shop name required', 400);

    const cat = await resolveShopCategory({ categoryId, categoryName });
    if (!cat) return sendFail(res, 'Category required', 400);

    const id = `shop_${randomUUID().slice(0, 10)}`;
    const keywords = `${shopName} ${cat.name} ${address || ''}`.toLowerCase();
    const shop = await Shop.create({
      id,
      shopName: String(shopName).trim().slice(0, 256),
      ownerName: String(ownerName || '').trim().slice(0, 256) || null,
      categoryId: cat.id,
      phone: String(phone || '').replace(/\D/g, '').slice(0, 10) || null,
      address: String(address || '').slice(0, 2000),
      city: String(city || 'Rajahmundry').slice(0, 64),
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      gstOrLicense: String(gstOrLicense || '').slice(0, 128) || null,
      leadPreference: normalizeLeadPreference(leadPreference),
      verificationStatus: 'pending',
      isActive: false,
      isFeatured: false,
      searchKeywords: keywords,
    });
    return sendOk(res, { id: shop.id, status: 'pending' }, 'Application submitted — we will verify your shop soon');
  } catch (e) {
    next(e);
  }
}

export async function listNearbyForPartner(req, res, next) {
  try {
    const p = await Partner.findByPk(req.partnerId);
    if (!req.query.lat && p?.latitude != null) req.query.lat = p.latitude;
    if (!req.query.lng && p?.longitude != null) req.query.lng = p.longitude;
    return listNearby(req, res, next);
  } catch (e) {
    next(e);
  }
}

export async function referShop(req, res, next) {
  try {
    const shop = await Shop.findByPk(req.params.id);
    if (!shop) return sendFail(res, 'Shop not found', 404);
    await shop.update({ referralCount: (shop.referralCount || 0) + 1 });
    return sendOk(res, { referralCount: shop.referralCount + 1 });
  } catch (e) {
    next(e);
  }
}
