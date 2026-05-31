import { Op } from 'sequelize';
import { Category, Service, Partner, Review, sequelize } from '../models/index.js';
import { sendOk } from '../utils/apiResponse.js';
import { toCatalogService, toServiceBucket } from '../serializers/mappers.js';
import { logSearch } from '../services/searchLogService.js';

const TERM_ALIASES = new Map([
  ['electrical', 'electrician'],
  ['electricals', 'electrician'],
  ['electrics', 'electrician'],
  ['plumbing', 'plumber'],
  ['plumbings', 'plumber'],
  ['drivers', 'driver'],
  ['homeservice', 'home repair'],
  ['home-service', 'home repair'],
]);

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item || '').trim()).filter(Boolean)
        : [value.trim()].filter(Boolean);
    } catch {
      return [value.trim()].filter(Boolean);
    }
  }
  return [];
}

function normalizePhrase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandPhrase(value) {
  const normalized = normalizePhrase(value);
  if (!normalized) return [];
  const alias = TERM_ALIASES.get(normalized);
  return alias ? [normalized, alias] : [normalized];
}

function splitToTerms(value) {
  return expandPhrase(value).flatMap((phrase) => phrase.split(' ').filter(Boolean));
}

function collectPartnerTerms(partner) {
  return [...parseJsonArray(partner.categories), ...parseJsonArray(partner.skills)]
    .flatMap(splitToTerms)
    .filter(Boolean);
}

function matchesServiceTerms(partner, terms) {
  const partnerTerms = new Set(collectPartnerTerms(partner));
  const serviceTerms = terms.flatMap(splitToTerms).filter(Boolean);
  return serviceTerms.some((term) => {
    if (partnerTerms.has(term)) return true;
    for (const partnerTerm of partnerTerms) {
      if (partnerTerm.includes(term) || term.includes(partnerTerm)) return true;
    }
    return false;
  });
}

export async function getBuckets(req, res, next) {
  try {
    const rows = await Category.findAll({ order: [['id', 'ASC']] });
    return sendOk(res, rows.map(toServiceBucket));
  } catch (e) {
    next(e);
  }
}

export async function getCatalog(req, res, next) {
  try {
    const rows = await Service.findAll({
      include: [{ model: Partner, as: 'partner' }],
      order: [['name', 'ASC']],
    });
    return sendOk(res, rows.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function getByBucket(req, res, next) {
  try {
    const { bucketId } = req.params;
    const rows = await Service.findAll({
      where: { categoryId: bucketId },
      include: [{ model: Partner, as: 'partner' }],
    });
    return sendOk(res, rows.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const row = await Service.findByPk(req.params.id, {
      include: [{ model: Partner, as: 'partner' }],
    });
    return sendOk(res, row ? toCatalogService(row) : null);
  } catch (e) {
    next(e);
  }
}

export async function search(req, res, next) {
  try {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase();
    const rows = await Service.findAll({
      include: [{ model: Partner, as: 'partner' }],
    });
    const filtered = !q
      ? rows
      : rows.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.categoryLabel.toLowerCase().includes(q) ||
            (s.subtext && s.subtext.toLowerCase().includes(q)),
        );
    if (q) {
      logSearch({
        query: q,
        resultsCount: filtered.length,
        city: req.query.city,
        userId: req.userId,
      }).catch(() => {});
    }
    return sendOk(res, filtered.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function topRated(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const rows = await Service.findAll({
      include: [{ model: Partner, as: 'partner' }],
    });
    const sorted = [...rows].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, limit);
    return sendOk(res, sorted.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function getServicePartners(req, res, next) {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) {
      return sendOk(res, []);
    }

    const lookupTerms = [service.name, service.categoryLabel].filter(Boolean).map((value) => String(value).trim());
    if (!lookupTerms.length) {
      return sendOk(res, []);
    }

    const partners = await Partner.findAll({
      where: {
        verificationStatus: { [Op.in]: ['Verified', 'Approved'] },
        isOnline: true,
      },
      order: [['rating', 'DESC'], ['jobsCompleted', 'DESC']],
    });

    const partnerIds = partners.map((p) => p.id);
    const reviewRows = partnerIds.length
      ? await Review.findAll({
          attributes: ['partnerId', [sequelize.fn('COUNT', sequelize.col('*')), 'count']],
          where: { partnerId: partnerIds },
          group: ['partnerId'],
          raw: true,
        })
      : [];
    const reviewCounts = reviewRows.reduce((acc, row) => {
      acc[row.partnerId] = Number(row.count);
      return acc;
    }, {});

    const matching = partners.filter((partner) => matchesServiceTerms(partner, lookupTerms));
    const payload = matching.map((p) => ({
      id: p.id,
      name: p.name,
      rating: Number(p.rating),
      jobsCompleted: p.jobsCompleted,
      photoUrl: p.photoUrl || undefined,
      reviewsCount: reviewCounts[p.id] ?? 0,
      categories: parseJsonArray(p.categories),
      isOnline: p.isOnline,
      distanceKm: null,
    }));

    return sendOk(res, payload);
  } catch (e) {
    next(e);
  }
}
