import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROLES = ['user', 'partner', 'admin'];

function backendEnvFilePath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');
}
/** @param {string} key */
function envTrim(key) {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

/**
 * Resolve signing/verification secret for a role.
 * Per-role secrets take precedence; `JWT_SECRET` is used as fallback for any role.
 */
export function getJwtSecretForRole(role) {
  const specificKey =
    role === 'user'
      ? 'JWT_USER_SECRET'
      : role === 'partner'
        ? 'JWT_PARTNER_SECRET'
        : role === 'admin'
          ? 'JWT_ADMIN_SECRET'
          : null;
  if (!specificKey) return null;
  return envTrim(specificKey) || envTrim('JWT_SECRET') || null;
}

/**
 * Call once after `dotenv/config` so the process never runs with missing JWT configuration.
 */
export function assertJwtSecretsConfigured() {
  const missing = ROLES.filter((role) => !getJwtSecretForRole(role));
  if (missing.length === 0) return;

  const hint =
    'Set JWT_USER_SECRET, JWT_PARTNER_SECRET, and JWT_ADMIN_SECRET (recommended), ' +
    'or set JWT_SECRET alone as a shared signing key for all roles.';

  const runningOnRailway = process.env.NEXGEN_RAILWAY === 'true' || Boolean(process.env.RAILWAY);

  if (runningOnRailway) {
    // In hosted environments we should not instruct users to create a local .env file.
    throw new Error(
      `[NEXGEN] Missing JWT secret for role(s): ${missing.join(', ')}. ${hint} ` +
        `Set the variables in your Railway (or platform) environment variables panel.`,
    );
  }

  // Local developer guidance (keep the old helpful message pointing to .env).
  const envFile = backendEnvFilePath();
  throw new Error(
    `[NEXGEN] Missing JWT secret for role(s): ${missing.join(', ')}. ${hint}\n` +
      `Expected a file at: ${envFile}\n` +
      `If it is missing, run: cp .env.example .env   (from the backend folder, same directory as package.json)`,
  );
}

/**
 * Return a machine-readable report of which JWT signing keys are available.
 */
export function jwtSecretsReport() {
  return {
    user: Boolean(getJwtSecretForRole('user')),
    partner: Boolean(getJwtSecretForRole('partner')),
    admin: Boolean(getJwtSecretForRole('admin')),
    shared: Boolean(envTrim('JWT_SECRET')),
  };

}

function expiresIn() {
  return envTrim('JWT_EXPIRES_IN') || '7d';
}

/**
 * @param {Record<string, unknown>} payload
 * @param {'user' | 'partner' | 'admin'} role
 */
export function signToken(payload, role) {
  const key = getJwtSecretForRole(role);
  if (!key) {
    throw new Error(
      `Missing JWT secret for role: ${role}. Set JWT_${String(role).toUpperCase()}_SECRET or JWT_SECRET in .env`,
    );
  }
  return jwt.sign({ ...payload, role }, key, { expiresIn: expiresIn() });
}

/**
 * @param {string} token
 * @param {'user' | 'partner' | 'admin'} role
 */
export function verifyToken(token, role) {
  const key = getJwtSecretForRole(role);
  if (!key) {
    throw new Error(`Missing JWT secret for role: ${role}`);
  }
  return jwt.verify(token, key);
}
