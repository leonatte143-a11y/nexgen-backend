/** Admin commission — matches mock bookingService (10% of subtotal = base + visiting). */
export const DEFAULT_VISITING_FEE = 30;
export const DEFAULT_VISITING_CHARGE_TIERS = [
  { maxKm: 5, amount: 30 },
  { maxKm: 10, amount: 60 },
  { maxKm: 15, amount: 90 },
];
export const COMMISSION_RATE = 0.1;
export const CANCELLATION_FEE_USER = 50;
export const PARTNER_ARRIVAL_CANCELLATION_CREDIT = 50;
export const PARTNER_HEAVY_DECLINE_CREDIT = 45;

/**
 * Distance-based visiting charge from tier matrix (km → ₹).
 * @param {number} distanceKm
 * @param {Array<{ maxKm: number, amount: number }>} tiers
 */
export function visitingChargeForDistance(distanceKm, tiers = DEFAULT_VISITING_CHARGE_TIERS) {
  const d = Math.max(0, Number(distanceKm) || 0);
  const sorted = [...(tiers || DEFAULT_VISITING_CHARGE_TIERS)].sort(
    (a, b) => Number(a.maxKm) - Number(b.maxKm),
  );
  for (const tier of sorted) {
    if (d <= Number(tier.maxKm)) return Number(tier.amount);
  }
  return Number(sorted[sorted.length - 1]?.amount ?? DEFAULT_VISITING_FEE);
}

export function computeBill(basePrice, visitingFee = DEFAULT_VISITING_FEE, adminPct = COMMISSION_RATE) {
  const subtotal = basePrice + visitingFee;
  const adminComm = Math.round(subtotal * adminPct);
  const total = subtotal + adminComm;
  return { visitingFee, adminComm, subtotal, total };
}

export function splitPartnerAmount(totalBeforePartner, adminComm) {
  return Math.max(0, totalBeforePartner - adminComm);
}
