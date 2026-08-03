/**
 * Must be imported first from `index.js` so `.env` is loaded before other modules read `process.env`.
 * Resolves `.env` from the backend package root (next to `package.json`), not only `process.cwd()`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Centralized dotenv initialization.
 * - In LOCAL development we load backend/.env (next to package.json).
 * - In hosted environments (Railway, Vercel, Heroku, etc.) we DO NOT require a local
 *   .env file and instead rely on the platform's environment variables.
 *
 * Railway variables are injected into process.env by the platform — do not copy
 * .env into the deployment container. Use the Railway Variables panel instead.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidateEnvPath = path.join(__dirname, '..', '.env');

// Heuristic: detect Railway via common Railway env vars. If any is present, assume
// we're running on Railway. This is intentionally conservative and may also match
// other CI-like environments; the behavior is safe (we won't require a .env file).
const isRailway = Boolean(
  process.env.RAILWAY ||
    process.env.RAILWAY_ENV ||
    process.env.RAILWAY_GIT_BRANCH ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_STATIC_URL,
);

// Expose detection to the rest of the app.
process.env.KAIRO_RAILWAY = isRailway ? 'true' : 'false';

// Only attempt to load a local .env when not running on Railway (local dev).
// Also allow forcing a local .env load by setting DOTENV_CONFIG_PATH.
if (!isRailway || process.env.DOTENV_CONFIG_PATH) {
  const result = dotenv.config({ path: candidateEnvPath });
  if (result.parsed) {
    // eslint-disable-next-line no-console
    console.log('[KAIRO] Loaded local .env from', candidateEnvPath);
  } else if (result.error && result.error.code !== 'ENOENT') {
    // eslint-disable-next-line no-console
    console.warn('[KAIRO] Could not read .env file:', result.error.message);
  } else if (!result.parsed) {
    // No .env present — only a concern in local development
    if (!isRailway) {
      // eslint-disable-next-line no-console
      console.warn('[KAIRO] No .env file found at', candidateEnvPath);
    }
  }
} else {
  // eslint-disable-next-line no-console
  console.log('[KAIRO] Running on Railway (or detected host). Using platform environment variables.');
}
