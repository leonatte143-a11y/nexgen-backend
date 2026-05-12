/** Admin commission — matches mock bookingService (10% of subtotal = base + visiting). */
export const DEFAULT_VISITING_FEE = 30;
export const COMMISSION_RATE = 0.1;
export const CANCELLATION_FEE_USER = 50;
export const PARTNER_ARRIVAL_CANCELLATION_CREDIT = 50;
export const PARTNER_HEAVY_DECLINE_CREDIT = 45;

export function computeBill(basePrice, visitingFee = DEFAULT_VISITING_FEE, adminPct = COMMISSION_RATE) {
  const subtotal = basePrice + visitingFee;
  const adminComm = Math.round(subtotal * adminPct);
  const total = subtotal + adminComm;
  return { visitingFee, adminComm, subtotal, total };
}

export function splitPartnerAmount(totalBeforePartner, adminComm) {
  return Math.max(0, totalBeforePartner - adminComm);
}
