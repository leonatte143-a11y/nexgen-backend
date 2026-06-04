import { Op } from 'sequelize';
import { VisitingChargeRule } from '../models/index.js';
import { haversineKm } from '../utils/haversine.js';
import { getSettings } from './appSettingsService.js';
import { visitingChargeForDistance } from './money.js';
import { toNum } from '../serializers/formatters.js';

/** Approximate city centers for fallback when GPS is unavailable */
export const CITY_CENTROIDS = {
  rajahmundry: { lat: 16.9902, lng: 81.7739 },
  guntur: { lat: 16.3067, lng: 80.4365 },
};

const DEFAULT_RULES = [
  { id: 'vcr_default_0_5', minKm: 0, maxKm: 5, charge: 30, city: null },
  { id: 'vcr_default_5_10', minKm: 5, maxKm: 10, charge: 60, city: null },
  { id: 'vcr_default_10_15', minKm: 10, maxKm: 15, charge: 90, city: null },
  { id: 'vcr_default_15_plus', minKm: 15, maxKm: null, charge: 120, city: null },
];

export async function ensureVisitingChargeRules() {
  for (const rule of DEFAULT_RULES) {
    await VisitingChargeRule.findOrCreate({
      where: { id: rule.id },
      defaults: { ...rule, isActive: true },
    });
  }
}

function normalizeCity(city) {
  const c = String(city || '').trim().toLowerCase();
  if (c.includes('guntur')) return 'guntur';
  if (c.includes('rajahmundry') || c.includes('rajamahendravaram')) return 'rajahmundry';
  return null;
}

export function resolveCityCentroid(city) {
  const key = normalizeCity(city);
  if (key && CITY_CENTROIDS[key]) return { ...CITY_CENTROIDS[key], city: key };
  return { ...CITY_CENTROIDS.rajahmundry, city: 'rajahmundry' };
}

export async function getActiveRules(city) {
  await ensureVisitingChargeRules();
  const key = normalizeCity(city);
  let rows = await VisitingChargeRule.findAll({
    where: { isActive: true },
    order: [['minKm', 'ASC']],
  });
  if (key) {
    const cityRows = rows.filter((r) => r.city && normalizeCity(r.city) === key);
    if (cityRows.length) rows = cityRows;
    else rows = rows.filter((r) => !r.city);
  } else {
    rows = rows.filter((r) => !r.city);
  }
  return rows;
}

export async function chargeForDistanceKm(distanceKm, city) {
  const d = Math.max(0, Number(distanceKm) || 0);
  const rules = await getActiveRules(city);
  if (rules.length) {
    for (const rule of rules) {
      const min = toNum(rule.minKm);
      const max = rule.maxKm != null ? toNum(rule.maxKm) : null;
      if (d >= min && (max == null || d <= max)) {
        return { distanceKm: d, amount: toNum(rule.charge), source: 'rules_table' };
      }
    }
    const last = rules[rules.length - 1];
    return { distanceKm: d, amount: toNum(last.charge), source: 'rules_table_max' };
  }
  const settings = await getSettings();
  const tiers = settings.visiting_charge_tiers;
  const amount = visitingChargeForDistance(d, tiers);
  return { distanceKm: d, amount, source: 'settings_tiers' };
}

/**
 * Quote visiting charge from coordinates (Haversine).
 * Falls back to default charge when coords missing.
 */
export async function quoteVisitingCharge({
  userLat,
  userLng,
  partnerLat,
  partnerLng,
  city,
  partnerId,
}) {
  let uLat = userLat != null ? Number(userLat) : null;
  let uLng = userLng != null ? Number(userLng) : null;
  let pLat = partnerLat != null ? Number(partnerLat) : null;
  let pLng = partnerLng != null ? Number(partnerLng) : null;

  const centroid = resolveCityCentroid(city);
  let usedFallback = false;
  let warning = null;

  if (uLat == null || uLng == null || Number.isNaN(uLat) || Number.isNaN(uLng)) {
    uLat = centroid.lat;
    uLng = centroid.lng;
    usedFallback = true;
    warning = 'User location unavailable; using city center estimate.';
  }
  if (pLat == null || pLng == null || Number.isNaN(pLat) || Number.isNaN(pLng)) {
    pLat = centroid.lat + 0.02;
    pLng = centroid.lng + 0.02;
    usedFallback = true;
    warning = warning || 'Partner location unavailable; using estimated coordinates.';
  }

  const distanceKm = haversineKm(uLat, uLng, pLat, pLng);
  const { amount, source } = await chargeForDistanceKm(distanceKm, city);

  return {
    distanceKm,
    visitingCharges: amount,
    userLat: uLat,
    userLng: uLng,
    partnerLat: pLat,
    partnerLng: pLng,
    partnerId: partnerId || null,
    city: city || centroid.city,
    usedFallback,
    warning,
    source,
  };
}
