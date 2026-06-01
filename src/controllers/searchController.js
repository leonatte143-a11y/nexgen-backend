import { sendOk, sendFail } from '../utils/apiResponse.js';
import { logSearch } from '../services/searchLogService.js';

export async function trackSearch(req, res, next) {
  try {
    const { keyword, query, location, city, latitude, longitude, resultCount, resultsCount, searchedByUserId, userId } =
      req.body;
    const q = keyword || query;
    if (!q) return sendFail(res, 'keyword required', 400);
    const count = resultCount ?? resultsCount ?? 0;
    await logSearch({
      query: q,
      resultsCount: count,
      city: location || city,
      lat: latitude,
      lng: longitude,
      userId: searchedByUserId || userId || req.userId || null,
    });
    return sendOk(res, { tracked: true }, 'ok');
  } catch (e) {
    next(e);
  }
}
