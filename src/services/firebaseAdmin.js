import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let auth = null;

function loadApp() {
  if (getApps().length) return getApps()[0];
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!path) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is not set — cannot verify Firebase phone-auth tokens.');
  }
  const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
  return initializeApp({ credential: cert(serviceAccount) });
}

function getFirebaseAuth() {
  if (!auth) {
    loadApp();
    auth = getAuth();
  }
  return auth;
}

/**
 * Verifies a Firebase Phone-Auth ID token from the mobile app and returns the
 * verified phone number (10-digit, no country code) on success.
 * @param {string} idToken
 * @returns {Promise<{ phone: string, uid: string }>}
 */
export async function verifyFirebasePhoneToken(idToken) {
  const decoded = await getFirebaseAuth().verifyIdToken(idToken);
  const rawPhone = String(decoded.phone_number || '');
  const phone = rawPhone.replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) {
    const err = new Error('Firebase token has no verified phone number.');
    err.status = 400;
    throw err;
  }
  return { phone, uid: decoded.uid };
}
