import { Op } from 'sequelize';
import { randomUUID } from 'crypto';

const MENU_WHERE = {
  isActive: true,
  [Op.or]: [{ approvalStatus: 'approved' }, { approvalStatus: null }],
};
import { Category, Service, Partner, Review, PartnerServicePricing, Notification, User, sequelize } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toCatalogService, toServiceBucket } from '../serializers/mappers.js';
import { logSearch } from '../services/searchLogService.js';
import { getSettings } from '../services/appSettingsService.js';
import { visitingChargeForDistance } from '../services/money.js';
import { toNum } from '../serializers/formatters.js';

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

/**
 * True if any token in tokensA equals, contains, or is contained by any token
 * in tokensB. This is the lenient "substring-both-ways" comparison — e.g.
 * "purohith" (from a sub-icon's searchQuery) overlaps "purohit" (from a
 * partner's registered skills/categories) because "purohith".includes("purohit").
 */
function tokensOverlap(tokensA, tokensB) {
  for (const a of tokensA) {
    for (const b of tokensB) {
      if (a === b || a.includes(b) || b.includes(a)) return true;
    }
  }
  return false;
}

function tokenizeText(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Lenient, token-based text match: true if any word of queryText overlaps
 * (equals or substring-either-direction) any word of candidateText. Used in
 * place of brittle exact `.includes()` checks so that admin-typed catalog
 * labels (Service.name/categoryLabel/subtext) and a sub-icon's searchQuery
 * don't need to share an exact substring to be considered a match.
 */
function tokenOverlapMatch(candidateText, queryText) {
  if (!candidateText || !queryText) return false;
  return tokensOverlap(tokenizeText(queryText), tokenizeText(candidateText));
}

function matchesServiceTerms(partner, terms) {
  const partnerTerms = new Set(collectPartnerTerms(partner));
  const serviceTerms = terms.flatMap(splitToTerms).filter(Boolean);
  return tokensOverlap(serviceTerms, partnerTerms);
}

/**
 * Exact id match: KYC approval flows (approveKycAddCategory / approveKycMapCategory)
 * push the Category.id (e.g. "home_repair", "cat_electrician_<hash>") directly into
 * partner.categories. Comparing that id against Service.categoryId is a reliable
 * id-to-id match, independent of whatever free-text wording admins typed for the
 * service name/categoryLabel.
 */
function matchesServiceCategoryId(partner, categoryId) {
  if (!categoryId) return false;
  const id = String(categoryId).trim().toLowerCase();
  if (!id) return false;
  return parseJsonArray(partner.categories).some((value) => String(value).trim().toLowerCase() === id);
}

export async function getBuckets(req, res, next) {
  try {
    const rows = await Category.findAll({ order: [['id', 'ASC']] });
    return sendOk(res, rows.map(toServiceBucket));
  } catch (e) {
    next(e);
  }
}

export async function listActiveCategories(_req, res, next) {
  try {
    const rows = await Category.findAll({
      where: { isActive: true },
      order: [['nameEn', 'ASC']],
      attributes: ['id', 'nameEn', 'emoji', 'iconUrl'],
    });
    return sendOk(res, rows.map((c) => ({ id: c.id, nameEn: c.nameEn, emoji: c.emoji, iconUrl: c.iconUrl })));
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
      : rows.filter((s) => {
          if (
            tokenOverlapMatch(s.name, q) ||
            tokenOverlapMatch(s.categoryLabel, q) ||
            tokenOverlapMatch(s.subtext, q)
          ) {
            return true;
          }
          // Root-cause fix: an admin-typed Service.name/categoryLabel/subtext
          // (set at KYC-approval time) doesn't always share wording with a
          // sub-icon's searchQuery, even when the partner IS the right match.
          // Fall back to the partner's own free-text registration
          // (categories/skills), which is more likely to contain the term a
          // user actually tapped (e.g. "Purohit").
          if (s.partner) {
            const partnerText = [...parseJsonArray(s.partner.categories), ...parseJsonArray(s.partner.skills)].join(
              ' ',
            );
            if (tokenOverlapMatch(partnerText, q)) return true;
          }
          return false;
        });
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
    const service = await Service.findByPk(req.params.id, {
      include: [{ model: Category, as: 'category', attributes: ['id', 'nameEn'] }],
    });
    if (!service) {
      return sendOk(res, []);
    }

    const lookupTerms = [service.name, service.categoryLabel, service.category?.nameEn]
      .filter(Boolean)
      .map((value) => String(value).trim());
    if (!lookupTerms.length && !service.categoryId) {
      return sendOk(res, []);
    }

    const partners = await Partner.findAll({
      where: {
        verificationStatus: { [Op.in]: ['Verified', 'Approved'] },
        archivedAt: null,
        isBlocked: false,
        accountStatus: { [Op.ne]: 'archived' },
      },
      order: [
        ['isOnline', 'DESC'],
        ['rating', 'DESC'],
        ['jobsCompleted', 'DESC'],
      ],
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

    const matching = partners.filter(
      (partner) =>
        matchesServiceCategoryId(partner, service.categoryId) || matchesServiceTerms(partner, lookupTerms),
    );
    const baseDistance = toNum(service.distanceKm) || 2.5;
    const payload = matching.map((p, index) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      rating: Number(p.rating),
      jobsCompleted: p.jobsCompleted,
      photoUrl: p.photoUrl || undefined,
      photos: parseJsonArray(p.photos),
      reviewsCount: reviewCounts[p.id] ?? 0,
      categories: parseJsonArray(p.categories),
      isOnline: Boolean(p.isOnline),
      distanceKm: Math.round((baseDistance + index * 0.3) * 10) / 10,
      description: p.description || '',
    }));

    return sendOk(res, payload);
  } catch (e) {
    next(e);
  }
}

/** GET /catalog/visiting-charge?distanceKm=1.2 */
export async function getVisitingCharge(req, res, next) {
  try {
    const settings = await getSettings();
    const tiers = settings.visiting_charge_tiers || settings.visitingChargeTiers;
    const distanceKm = Math.max(0, parseFloat(String(req.query.distanceKm ?? '0')) || 0);
    const amount = visitingChargeForDistance(distanceKm, tiers);
    return sendOk(res, { distanceKm, amount, tiers: tiers || [] });
  } catch (e) {
    next(e);
  }
}

/** GET /catalog/services/:id/partners/:partnerId/menu */
export async function getPartnerServiceMenu(req, res, next) {
  try {
    const { id: serviceId, partnerId } = req.params;
    const service = await Service.findByPk(serviceId);
    if (!service) return sendOk(res, { items: [] });

    const partner = await Partner.findByPk(partnerId);
    if (!partner) return sendOk(res, { items: [] });

    const rows = await PartnerServicePricing.findAll({
      where: { partnerId, ...MENU_WHERE },
      order: [['serviceName', 'ASC']],
    });

    const categoryLabel = String(service.categoryLabel || '').toLowerCase();
    const filtered = rows.filter((row) => {
      const cat = String(row.category || '').toLowerCase();
      if (!cat || !categoryLabel) return true;
      return cat === categoryLabel || categoryLabel.includes(cat) || cat.includes(categoryLabel);
    });

    const source = filtered.length ? filtered : rows;
    const items =
      source.length > 0
        ? source.map((row) => ({
            id: row.id,
            title: row.serviceName || service.name,
            subtitle: row.category || service.subtext || '',
            price: toNum(row.baseCost),
          }))
        : [
            {
              id: `svc_${service.id}`,
              title: service.name,
              subtitle: service.subtext || 'Standard service',
              price: toNum(service.basePrice),
            },
          ];

    return sendOk(res, { items, partnerId, serviceId });
  } catch (e) {
    next(e);
  }
}

/** POST /catalog/partners/:partnerId/view — logs a User opening a Partner's profile as an "enquiry" notification for that partner. */
export async function logProfileView(req, res, next) {
  try {
    const { partnerId } = req.params;
    const partner = await Partner.findByPk(partnerId);
    if (!partner) return sendFail(res, 'Partner not found', 404);

    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);

    const viewerName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'A user';
    const viewerPhone = user.phone || null;
    const viewerLocation = user.address || null;

    await Notification.create({
      id: `n_${randomUUID().slice(0, 10)}`,
      partnerId: partner.id,
      userId: null,
      type: 'enquiry',
      title: 'Profile viewed',
      body: `${viewerName} viewed your profile`,
      payload: { viewerName, viewerPhone, viewerLocation },
      read: false,
      timeLabel: 'now',
    });

    return sendOk(res, true);
  } catch (e) {
    next(e);
  }
}
