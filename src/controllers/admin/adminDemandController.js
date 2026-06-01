import { fn, col, literal, Op } from 'sequelize';
import { SearchLog } from '../../models/index.js';
import { sendOk } from '../../utils/apiResponse.js';

export async function listDemandAnalytics(req, res, next) {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const zeroOnly = req.query.zeroOnly === 'true';

    const where = zeroOnly ? { resultsCount: 0 } : {};

    const rows = await SearchLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
    });

    return sendOk(
      res,
      rows.map((r) => ({
        id: r.id,
        keyword: r.query,
        location: r.city,
        latitude: r.lat,
        longitude: r.lng,
        resultCount: r.resultsCount,
        searchedByUserId: r.userId,
        createdAt: r.createdAt,
      })),
      'ok',
    );
  } catch (e) {
    next(e);
  }
}

export async function demandAnalyticsSummary(_req, res, next) {
  try {
    const [topKeywords, topLocations, zeroResult] = await Promise.all([
      SearchLog.findAll({
        attributes: ['query', [fn('COUNT', col('id')), 'count']],
        group: ['query'],
        order: [[literal('count'), 'DESC']],
        limit: 10,
        raw: true,
      }),
      SearchLog.findAll({
        attributes: ['city', [fn('COUNT', col('id')), 'count']],
        group: ['city'],
        order: [[literal('count'), 'DESC']],
        limit: 10,
        raw: true,
      }),
      SearchLog.findAll({
        where: { resultsCount: 0 },
        order: [['createdAt', 'DESC']],
        limit: 20,
      }),
    ]);

    return sendOk(
      res,
      {
        topKeywords: topKeywords.map((r) => ({
          keyword: r.query,
          searches: Number(r.count),
        })),
        topLocations: topLocations.map((r) => ({
          location: r.city || 'Unknown',
          searches: Number(r.count),
        })),
        zeroResultSearches: zeroResult.map((r) => ({
          id: r.id,
          keyword: r.query,
          location: r.city,
          latitude: r.lat,
          longitude: r.lng,
          createdAt: r.createdAt,
        })),
      },
      'ok',
    );
  } catch (e) {
    next(e);
  }
}
