import bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { OtpVerification } from '../models/index.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REQUESTS_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = Number(process.env.OTP_MAX_REQUESTS_PER_15M || 5);
const MAX_VERIFY_ATTEMPTS = Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5);

export function getOtpDigitLength() {
  const n = parseInt(process.env.OTP_DIGITS || '6', 10);
  return n === 4 ? 4 : 6;
}

async function generatePlainOtp() {
  const digits = getOtpDigitLength();
  if (digits === 4) return String(randomInt(1000, 10000));
  return String(randomInt(100000, 1000000));
}

async function assertCanRequestOtp(phone) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - MAX_REQUESTS_WINDOW_MS);
  const recentCount = await OtpVerification.count({
    where: { phone, createdAt: { [Op.gte]: windowStart } },
  });
  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    const err = new Error('Too many OTP requests. Please try again in 15 minutes.');
    err.status = 429;
    err.code = 'OTP_RATE_LIMIT';
    throw err;
  }
  const cooldownStart = new Date(now.getTime() - RESEND_COOLDOWN_MS);
  const lastRecent = await OtpVerification.findOne({
    where: { phone, createdAt: { [Op.gte]: cooldownStart } },
    order: [['createdAt', 'DESC']],
  });
  if (lastRecent) {
    const elapsed = now.getTime() - new Date(lastRecent.createdAt).getTime();
    const retryAfterSec = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
    const err = new Error(`Please wait ${retryAfterSec}s before requesting a new OTP.`);
    err.status = 429;
    err.code = 'OTP_COOLDOWN';
    err.retryAfterSec = retryAfterSec;
    throw err;
  }
}

export async function invalidatePendingOtps(phone) {
  const now = new Date();
  await OtpVerification.update(
    { expiresAt: new Date(0) },
    { where: { phone, isVerified: false, expiresAt: { [Op.gt]: now } } },
  );
}

/**
 * Creates a new OTP row. Previous active OTPs for the phone are invalidated.
 * @returns {{ plain: string, expiresAt: Date }}
 */
export async function issueOtp(phone) {
  await assertCanRequestOtp(phone);
  await invalidatePendingOtps(phone);
  const plain = await generatePlainOtp();
  const hash = await bcrypt.hash(plain, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await OtpVerification.create({
    id: randomUUID(),
    phone,
    otp: hash,
    expiresAt,
    isVerified: false,
    attempts: 0,
  });
  return { plain, expiresAt };
}

/**
 * Verifies OTP for phone; on success the row is removed (no reuse).
 */
export async function verifyOtpRecord(phone, plainOtp) {
  const now = new Date();
  const row = await OtpVerification.findOne({
    where: { phone, isVerified: false, expiresAt: { [Op.gt]: now } },
    order: [['createdAt', 'DESC']],
  });
  if (!row) {
    return {
      ok: false,
      reason: 'INVALID_OR_EXPIRED',
      message: 'Invalid or expired OTP. Request a new code.',
    };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    await row.destroy();
    return { ok: false, reason: 'LOCKED', message: 'Too many attempts. Request a new OTP.' };
  }
  const match = await bcrypt.compare(plainOtp, row.otp);
  if (!match) {
    await row.increment('attempts');
    await row.reload();
    if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
      await row.destroy();
      return { ok: false, reason: 'LOCKED', message: 'Too many attempts. Request a new OTP.' };
    }
    return {
      ok: false,
      reason: 'INVALID',
      message: 'Incorrect OTP. Try again.',
      attemptsLeft: MAX_VERIFY_ATTEMPTS - row.attempts,
    };
  }
  await row.destroy();
  return { ok: true };
}
