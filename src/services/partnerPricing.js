import { getSettings } from './appSettingsService.js';

const DEFAULT_MIN = 100;
const DEFAULT_MAX = 1000;

export async function getPartnerPriceLimits() {
  const settings = await getSettings();
  const min = Number(settings.partner_price_min ?? DEFAULT_MIN);
  const max = Number(settings.partner_price_max ?? DEFAULT_MAX);
  return {
    min: Number.isFinite(min) ? min : DEFAULT_MIN,
    max: Number.isFinite(max) ? max : DEFAULT_MAX,
  };
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
