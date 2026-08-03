import { Op } from 'sequelize';
import { Partner, Booking } from '../models/index.js';
import { haversineKm } from '../utils/haversine.js';
import { CITY_CENTROIDS } from './visitingChargeService.js';
import { toNum } from '../serializers/formatters.js';

const PARTNER_AT_SHOP_KM = 0.15;

/** Map active service keywords to shop category ids for job recommendations. */
const JOB_TO_SHOP_CATEGORY = [
  { keywords: ['electric', 'fan', 'wire', 'cable', 'ac'], categories: ['electrical', 'hardware'] },
  { keywords: ['plumb', 'pipe', 'tap', 'water'], categories: ['plumbing', 'hardware'] },
  { keywords: ['paint', 'colour'], categories: ['hardware', 'construction'] },
  { keywords: ['tile', 'marble', 'cement'], categories: ['construction', 'hardware'] },
  { keywords: ['cctv', 'camera'], categories: ['electronics', 'electrical'] },
];

export function defaultCoords(lat, lng) {
  const uLat = parseFloat(lat);
  const uLng = parseFloat(lng);
  if (Number.isFinite(uLat) && Number.isFinite(uLng)) return { lat: uLat, lng: uLng };
  return { lat: CITY_CENTROIDS.rajahmundry.lat, lng: CITY_CENTROIDS.rajahmundry.lng };
}

export function shopMatchesQuery(shop, category, q) {
  if (q) {
    const hay = `${shop.shopName} ${shop.searchKeywords || ''} ${category?.name || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (shop.categoryId && q && shop.categoryId.includes(q)) return true;
  return true;
}

export function enrichShopRow(shop, category, userLat, userLng, partnerNearby) {
  const lat = toNum(shop.latitude);
  const lng = toNum(shop.longitude);
  const distanceKm =
    lat && lng ? haversineKm(userLat, userLng, lat, lng) : null;
  return {
    id: shop.id,
    shopName: shop.shopName,
    ownerName: shop.ownerName,
    categoryId: shop.categoryId,
    categoryName: category?.name || shop.categoryId,
    phone: shop.phone,
    address: shop.address,
    city: shop.city,
    latitude: lat,
    longitude: lng,
    leadPreference: shop.leadPreference,
    photoUrl: shop.photoUrl || null,
    rating: toNum(shop.rating),
    isFeatured: Boolean(shop.isFeatured),
    distanceKm,
    distanceLabel: distanceKm != null ? `${distanceKm.toFixed(1)} km` : '—',
    partnerNearby: Boolean(partnerNearby),
    partnerNearbyLabel: partnerNearby ? 'KAIRO Partner nearby' : null,
  };
}

export async function findPartnerNearbyShop(shopLat, shopLng) {
  if (!shopLat || !shopLng) return null;
  const partners = await Partner.findAll({
    where: { isOnline: true, latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
    attributes: ['id', 'name', 'latitude', 'longitude'],
    limit: 50,
  });
  for (const p of partners) {
    const d = haversineKm(shopLat, shopLng, toNum(p.latitude), toNum(p.longitude));
    if (d <= PARTNER_AT_SHOP_KM) return { id: p.id, name: p.name };
  }
  return null;
}

export async function recommendedCategoryIdsForUser(userId) {
  if (!userId) return [];
  const active = await Booking.findOne({
    where: {
      userId,
      userStatus: { [Op.in]: ['partner_assigned', 'en_route', 'in_progress'] },
    },
    order: [['createdAt', 'DESC']],
  });
  if (!active) return [];
  const text = `${active.serviceName || ''} ${active.categoryLabel || ''}`.toLowerCase();
  const ids = new Set();
  for (const row of JOB_TO_SHOP_CATEGORY) {
    if (row.keywords.some((k) => text.includes(k))) {
      row.categories.forEach((c) => ids.add(c));
    }
  }
  return [...ids];
}
