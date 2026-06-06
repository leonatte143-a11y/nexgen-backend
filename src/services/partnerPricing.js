import { Op } from 'sequelize';
import { Category } from '../models/index.js';
import { getSettings } from './appSettingsService.js';

const DEFAULT_MIN = 100;
const DEFAULT_MAX = 1000;

async function resolveGlobalLimits() {
  const settings = await getSettings();
  const min = Number(settings.partner_price_min ?? DEFAULT_MIN);
  const max = Number(settings.partner_price_max ?? DEFAULT_MAX);
  return {
    min: Number.isFinite(min) ? min : DEFAULT_MIN,
    max: Number.isFinite(max) ? max : DEFAULT_MAX,
  };
}

async function resolveCategoryLimits(categoryName) {
  if (!categoryName) return null;
  const label = String(categoryName).trim();
  const cat = await Category.findOne({
    where: {
      [Op.or]: [{ nameEn: label }, { id: label }],
    },
  });
  if (!cat || cat.minPrice == null || cat.maxPrice == null) return null;
  const min = Number(cat.minPrice);
  const max = Number(cat.maxPrice);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max, categoryId: cat.id, categoryName: cat.nameEn };
}

export async function getPartnerPriceLimits(categoryName = null) {
  const categoryLimits = await resolveCategoryLimits(categoryName);
  if (categoryLimits) {
    return categoryLimits;
  }
  return resolveGlobalLimits();
}

export async function getPartnerPriceLimitsPayload() {
  const global = await resolveGlobalLimits();
  const categories = await Category.findAll({
    where: { isActive: { [Op.ne]: false } },
    order: [['nameEn', 'ASC']],
  });
  const byCategory = {};
  for (const cat of categories) {
    if (cat.minPrice != null && cat.maxPrice != null) {
      byCategory[cat.nameEn] = {
        min: Number(cat.minPrice),
        max: Number(cat.maxPrice),
      };
    }
  }
  return { ...global, byCategory };
}

/**
 * @param {number} price
 * @returns {{ ok: true, approvalStatus: 'approved' } | { ok: false, approvalStatus: 'pending_review', message: string }}
 */
export function evaluatePartnerPrice(price, limits) {
  const p = Math.round(Number(price));
  if (!p || p < 1) {
    return { ok: false, approvalStatus: 'pending_review', message: 'Enter a valid price.' };
  }
  if (p < limits.min || p > limits.max) {
    return {
      ok: false,
      approvalStatus: 'pending_review',
      message: `Price must be between ₹${limits.min} and ₹${limits.max}. Submitted for admin review.`,
    };
  }
  return { ok: true, approvalStatus: 'approved' };
}

export function mapPricingRow(r, limits) {
  return {
    id: r.id,
    serviceName: r.serviceName,
    category: r.category,
    baseCost: Number(r.baseCost),
    isActive: Boolean(r.isActive),
    approvalStatus: r.approvalStatus || 'approved',
    withinLimits:
      Number(r.baseCost) >= limits.min &&
      Number(r.baseCost) <= limits.max &&
      (r.approvalStatus || 'approved') === 'approved',
  };
}
