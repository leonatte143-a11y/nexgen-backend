import { randomInt } from 'crypto';
import { Favorite, Partner } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';

export async function listMyFavorites(req, res, next) {
  try {
    const rows = await Favorite.findAll({
      where: { userId: req.userId },
      include: [{ model: Partner, as: 'partner' }],
      order: [['createdAt', 'DESC']],
    });
    return sendOk(
      res,
      rows.map((f) => ({
        id: f.id,
        partnerId: f.partnerId,
        partner: f.partner
          ? {
              id: f.partner.id,
              name: f.partner.name,
              rating: f.partner.rating,
              jobsCompleted: f.partner.jobsCompleted,
              photoUrl: f.partner.photoUrl || '',
            }
          : null,
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function addFavorite(req, res, next) {
  try {
    const partnerId = String(req.body?.partnerId || '').trim();
    if (!partnerId) return sendFail(res, 'partnerId required', 400);
    const id = `fav_${Date.now()}_${randomInt(100, 1000)}`;
    const [row] = await Favorite.findOrCreate({
      where: { userId: req.userId, partnerId },
      defaults: { id, userId: req.userId, partnerId },
    });
    return sendOk(res, { id: row.id, partnerId: row.partnerId }, 'Added');
  } catch (e) {
    next(e);
  }
}

export async function removeFavorite(req, res, next) {
  try {
    const partnerId = String(req.params.partnerId || '').trim();
    if (!partnerId) return sendFail(res, 'partnerId required', 400);
    await Favorite.destroy({ where: { userId: req.userId, partnerId } });
    return sendOk(res, { partnerId }, 'Removed');
  } catch (e) {
    next(e);
  }
}

