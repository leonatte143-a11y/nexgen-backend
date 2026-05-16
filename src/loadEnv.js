/**
 * Must be imported first from `index.js` so `.env` is loaded before other modules read `process.env`.
 * Resolves `.env` from the backend package root (next to `package.json`), not only `process.cwd()`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error && result.error.code !== 'ENOENT') {
  // eslint-disable-next-line no-console
  console.warn('[NEXGEN] Could not read .env file:', result.error.message);
}
