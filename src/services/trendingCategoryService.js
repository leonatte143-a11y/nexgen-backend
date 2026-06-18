import { TrendingCategory } from '../models/index.js';

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

/** Increment search_count for a category string and refresh top-5 trending flags. */
export async function bumpCategorySearch(rawName) {
  const name = String(rawName || '').trim();
  if (!name || name.length < 2) return;
  const id = slugify(name) || `cat_${Date.now()}`;
  const [row] = await TrendingCategory.findOrCreate({
    where: { id },
    defaults: { id, name, searchCount: 0, isTrending: false },
  });
  await row.update({ name, searchCount: (row.searchCount || 0) + 1 });
  await refreshTrendingFlags();
}

export async function refreshTrendingFlags() {
  const all = await TrendingCategory.findAll({ order: [['searchCount', 'DESC']] });
  const topIds = new Set(all.slice(0, 5).map((r) => r.id));
  await Promise.all(
    all.map((r) => r.update({ isTrending: topIds.has(r.id) && (r.searchCount || 0) > 0 })),
  );
}

export async function getTrendingSuggestions(limit = 5) {
  await refreshTrendingFlags();
  const trending = await TrendingCategory.findAll({
    where: { isTrending: true },
    order: [['searchCount', 'DESC']],
    limit,
  });
  if (trending.length >= limit) return trending.map((r) => ({ id: r.id, name: r.name, searchCount: r.searchCount }));
  const extra = await TrendingCategory.findAll({
    order: [['searchCount', 'DESC']],
    limit,
  });
  return extra.map((r) => ({ id: r.id, name: r.name, searchCount: r.searchCount }));
}

export { slugify };
