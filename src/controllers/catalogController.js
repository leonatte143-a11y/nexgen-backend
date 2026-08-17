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
import { haversineKm } from '../utils/haversine.js';

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
 * Generic category vocabulary that must NEVER establish a match on its own —
 * e.g. "AC Service" and "Home Services" share only the word "service(s)",
 * which caused partners with ANY category to leak into unrelated categories
 * (the "Divya" bug: a Painter/AC Service/House Cleaning partner showing up
 * under every bucket whose label happens to also contain "service"/"home").
 * A token in this list is skipped as a match signal by itself; two phrases
 * still match if they share any OTHER, more distinctive word (e.g. "cleaning",
 * "painter", "purohit").
 */
const GENERIC_STOPWORDS = new Set([
  'service', 'services', 'home', 'repair', 'repairs', 'work', 'works',
  'center', 'centre', 'shop', 'shops', 'and', 'for', 'the', 'of', 'a', 'an',
  'on', 'in', 'to', 'with',
]);

/**
 * True if any DISTINCTIVE token in tokensA equals, contains, or is contained
 * by any distinctive token in tokensB (generic stopwords excluded from the
 * comparison — see GENERIC_STOPWORDS). This is the lenient "substring-both-ways"
 * comparison — e.g. "purohith" (from a sub-icon's searchQuery) overlaps
 * "purohit" (from a partner's registered skills/categories) because
 * "purohith".includes("purohit") — while NOT letting two otherwise-unrelated
 * multi-word categories match purely because they both contain "service".
 */
function tokensOverlap(tokensA, tokensB) {
  for (const a of tokensA) {
    if (GENERIC_STOPWORDS.has(a)) continue;
    for (const b of tokensB) {
      if (GENERIC_STOPWORDS.has(b)) continue;
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

/**
 * "Virtual" service ids (see getByBucket) represent a partner surfaced in a
 * category purely via their own `categories`/`skills` array, with no
 * curated Service row backing them. Encoded as `virtual::<categoryId>::<partnerId>`
 * using `::` — a separator that never appears inside a slug-style id/partnerId —
 * so both segments can be reliably recovered regardless of underscores in
 * either id.
 */
function makeVirtualServiceId(categoryId, partnerId) {
  return `virtual::${categoryId}::${partnerId}`;
}

function parseVirtualServiceId(id) {
  if (typeof id !== 'string' || !id.startsWith('virtual::')) return null;
  const parts = id.split('::');
  if (parts.length !== 3) return null;
  return { categoryId: parts[1], partnerId: parts[2] };
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
    // Optional sub-category search term (e.g. "purohith") — passed through by
    // ServiceListScreen's bucket-fallback call. `bucketId` alone only tells us
    // the broad parent category; a specific sub-icon's term is what actually
    // identifies which partners belong under IT specifically, so when present
    // it drives the real matching below instead of the much coarser
    // bucket-name comparison.
    const q = String(req.query.q || '').trim();

    let rows = await Service.findAll({
      where: { categoryId: bucketId },
      include: [{ model: Partner, as: 'partner' }],
    });

    // Root-cause fix: this endpoint previously only surfaced partners who
    // happen to have an admin-curated Service row for this exact category.
    // A partner's own `categories` array (which can hold multiple categories,
    // e.g. ["Purohit", "Driver", "Teacher"]) was never consulted here, so a
    // partner with several categories only appeared under whichever one
    // category an admin manually created a catalog row for — not "the first
    // category" by any array-order logic, just whichever got curated.
    // Fix: also match any verified partner whose `categories`/`skills` array
    // contains this bucketId (id match) or — when a specific sub-icon term is
    // given — token-overlaps that term (e.g. "purohit" vs "purohith"), and
    // synthesize a catalog-service-shaped entry for any such partner who
    // doesn't already have a real Service row here, so every category a
    // partner registered under now correctly surfaces them.
    if (q) {
      rows = rows.filter((r) => {
        if (
          tokenOverlapMatch(r.name, q) ||
          tokenOverlapMatch(r.categoryLabel, q) ||
          tokenOverlapMatch(r.subtext, q)
        ) {
          return true;
        }
        if (r.partner) {
          const partnerText = [...parseJsonArray(r.partner.categories), ...parseJsonArray(r.partner.skills)].join(' ');
          if (tokenOverlapMatch(partnerText, q)) return true;
        }
        return false;
      });
    }

    const existingPartnerIds = new Set(rows.map((r) => r.partnerId));
    const category = await Category.findByPk(bucketId);
    const categoryName = category?.nameEn || bucketId;

    const candidatePartners = await Partner.findAll({
      where: {
        verificationStatus: { [Op.in]: ['Verified', 'Approved'] },
        archivedAt: null,
        isBlocked: false,
        accountStatus: { [Op.ne]: 'archived' },
      },
    });

    const virtualEntries = candidatePartners
      .filter((partner) => !existingPartnerIds.has(partner.id))
      .filter((partner) => {
        if (matchesServiceCategoryId(partner, bucketId)) return true;
        const partnerText = [...parseJsonArray(partner.categories), ...parseJsonArray(partner.skills)].join(' ');
        // With a specific sub-icon term, match against THAT term (precise —
        // this is what actually identifies "Purohit" vs "Driver" vs
        // "Teacher"). Without one (a plain "browse this whole bucket" view,
        // no sub-icon tapped), fall back to the looser bucket-name overlap —
        // imprecise, but only used when there's no specific term to match
        // against at all, and only ever adds candidates, never removes any.
        return q ? tokenOverlapMatch(partnerText, q) : tokenOverlapMatch(partnerText, categoryName);
      })
      .map((partner) => ({
        id: makeVirtualServiceId(bucketId, partner.id),
        categoryId: bucketId,
        name: categoryName,
        subtext: '',
        categoryLabel: categoryName,
        basePrice: toNum(category?.minPrice) || 0,
        premiumPrice: toNum(category?.maxPrice) || toNum(category?.minPrice) || 0,
        rating: toNum(partner.rating),
        reviewsCount: 0,
        distanceKm: 2.5,
        description: partner.description || '',
        partner,
      }));

    return sendOk(res, [...rows, ...virtualEntries].map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const virtual = parseVirtualServiceId(req.params.id);
    if (virtual) {
      const [category, partner] = await Promise.all([
        Category.findByPk(virtual.categoryId),
        Partner.findByPk(virtual.partnerId),
      ]);
      if (!partner) return sendOk(res, null);
      const categoryName = category?.nameEn || virtual.categoryId;
      const synthesized = {
        id: req.params.id,
        categoryId: virtual.categoryId,
        name: categoryName,
        subtext: '',
        categoryLabel: categoryName,
        basePrice: toNum(category?.minPrice) || 0,
        premiumPrice: toNum(category?.maxPrice) || toNum(category?.minPrice) || 0,
        rating: toNum(partner.rating),
        reviewsCount: 0,
        distanceKm: 2.5,
        description: partner.description || '',
        partner,
      };
      return sendOk(res, toCatalogService(synthesized));
    }

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
    let categoryId;
    let lookupTerms;
    let baseDistanceSeed = 2.5;

    const virtual = parseVirtualServiceId(req.params.id);
    if (virtual) {
      // Virtual ids (see getByBucket) aren't real Service rows — resolve
      // matching purely by category, same as the real-Service path below,
      // so tapping through from a virtual entry shows the same category-wide
      // partner list a curated Service row for this category would.
      categoryId = virtual.categoryId;
      const category = await Category.findByPk(categoryId);
      lookupTerms = [category?.nameEn].filter(Boolean).map((value) => String(value).trim());
      if (!lookupTerms.length && !categoryId) {
        return sendOk(res, []);
      }
    } else {
      const service = await Service.findByPk(req.params.id, {
        include: [{ model: Category, as: 'category', attributes: ['id', 'nameEn'] }],
      });
      if (!service) {
        return sendOk(res, []);
      }
      categoryId = service.categoryId;
      lookupTerms = [service.name, service.categoryLabel, service.category?.nameEn]
        .filter(Boolean)
        .map((value) => String(value).trim());
      if (!lookupTerms.length && !categoryId) {
        return sendOk(res, []);
      }
      baseDistanceSeed = toNum(service.distanceKm) || 2.5;
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

    let matching = partners.filter(
      (partner) =>
        matchesServiceCategoryId(partner, categoryId) || matchesServiceTerms(partner, lookupTerms),
    );
    if (virtual) {
      // A virtual id was discovered in getByBucket by matching the partner's
      // OWN categories/skills against the SPECIFIC sub-icon term (e.g.
      // "purohith"), which this function has no way to re-derive from just
      // categoryId + the bucket's own name (e.g. "Events" — too broad to
      // match "Purohit" text). Since the virtual id already encodes exactly
      // which partner it was built for, guarantee that partner is present in
      // the result regardless of whether the broader category/name-based
      // filter above happens to also catch them.
      const alreadyIncluded = matching.some((p) => p.id === virtual.partnerId);
      if (!alreadyIncluded) {
        const exactPartner = partners.find((p) => p.id === virtual.partnerId);
        if (exactPartner) matching = [exactPartner, ...matching];
      }
    }
    const baseDistance = baseDistanceSeed;
    const userLat = req.query.lat != null ? Number(req.query.lat) : null;
    const userLng = req.query.lng != null ? Number(req.query.lng) : null;
    const hasUserCoords = Number.isFinite(userLat) && Number.isFinite(userLng);
    const payload = matching.map((p, index) => {
      const partnerLat = p.latitude != null ? Number(p.latitude) : null;
      const partnerLng = p.longitude != null ? Number(p.longitude) : null;
      const hasPartnerCoords = Number.isFinite(partnerLat) && Number.isFinite(partnerLng);
      const distanceKm =
        hasUserCoords && hasPartnerCoords
          ? haversineKm(userLat, userLng, partnerLat, partnerLng)
          : Math.round((baseDistance + index * 0.3) * 10) / 10;
      return {
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
        distanceKm,
        description: p.description || '',
        serviceOuterRadiusKm: p.serviceOuterRadiusKm != null ? Number(p.serviceOuterRadiusKm) : null,
        allowOutOfStation: Boolean(p.allowOutOfStation),
      };
    });

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
