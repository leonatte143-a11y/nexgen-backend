import { randomUUID } from 'crypto';
import { SearchLog } from '../models/index.js';
import { bumpCategorySearch } from './trendingCategoryService.js';

export async function logSearch({ query, resultsCount, city, lat, lng, userId }) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return;
  await SearchLog.create({
    id: `sl_${randomUUID().slice(0, 12)}`,
    query: q,
    resultsCount: resultsCount ?? 0,
    city: city || 'Rajahmundry',
    lat: lat ?? null,
    lng: lng ?? null,
    userId: userId || null,
    source: 'search',
  });
  await bumpCategorySearch(q).catch(() => {});
}

export async function logCustomRequirement({ text, city, userId }) {
  const detail = String(text || '').trim();
  if (!detail) return;
  const q = detail.toLowerCase().slice(0, 256);
  await SearchLog.create({
    id: `sl_${randomUUID().slice(0, 12)}`,
    query: q,
    resultsCount: 0,
    city: city || 'Rajahmundry',
    lat: null,
    lng: null,
    userId: userId || null,
    source: 'custom_requirement',
    detailText: detail.slice(0, 2000),
  });
  await bumpCategorySearch(q).catch(() => {});
}

