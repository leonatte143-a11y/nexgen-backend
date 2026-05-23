import { randomUUID } from 'crypto';
import { SearchLog } from '../models/index.js';

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
  });
}
