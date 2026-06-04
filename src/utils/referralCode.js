import { User } from '../models/index.js';

const DEFAULT_PREFIX = 'NEXGEN';

function slugPart(value, maxLen = 6) {
  const s = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLen);
  return s || 'USER';
}

/** Build a human-readable referral code (not guaranteed unique until persisted). */
export function buildReferralCode({ firstName, lastName, phone, id }) {
  const namePart = slugPart(firstName || lastName, 6);
  const tail = String(phone || id || '')
    .replace(/\D/g, '')
    .slice(-4);
  const suffix = tail.length >= 4 ? tail : String(Date.now()).slice(-4);
  return `${DEFAULT_PREFIX}-${namePart}-${suffix}`;
}

/** Ensure user has a unique referralCode; updates DB when missing or generic. */
export async function ensureUserReferralCode(user) {
  const generic = new Set(['NEXGEN2026', 'NEXGEN', '']);
  const current = String(user.referralCode || '').trim();
  if (current && !generic.has(current)) {
    const taken = await User.findOne({
      where: { referralCode: current },
      attributes: ['id'],
    });
    if (!taken || taken.id === user.id) return current;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate =
      attempt === 0
        ? buildReferralCode(user)
        : `${DEFAULT_PREFIX}-${slugPart(user.firstName, 4)}-${String(user.phone || user.id).replace(/\D/g, '').slice(-4)}${attempt}`;
    const exists = await User.findOne({
      where: { referralCode: candidate },
      attributes: ['id'],
    });
    if (!exists || exists.id === user.id) {
      user.referralCode = candidate;
      await user.save();
      return candidate;
    }
  }

  const fallback = `${DEFAULT_PREFIX}-${user.id.slice(-8).toUpperCase()}`;
  user.referralCode = fallback;
  await user.save();
  return fallback;
}
