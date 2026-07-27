import { sendOk } from '../utils/apiResponse.js';
import { getMapsKeySetting } from '../services/appSettingsService.js';

/** Public runtime config the apps fetch on startup (no rebuild needed for key rotation). */
export async function getPublicConfig(_req, res, next) {
  try {
    const { apiKey } = await getMapsKeySetting();
    return sendOk(res, { googleMapsApiKey: apiKey || null });
  } catch (e) {
    next(e);
  }
}
