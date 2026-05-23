import { Op } from 'sequelize';
import { parseCityQuery } from '../utils/bannerValidation.js';

export function buildActiveBannerWhere(cityQuery) {
  const now = new Date();
  const city = parseCityQuery(cityQuery);

  const where = {
    isActive: true,
    [Op.and]: [
      {
        [Op.or]: [{ startDate: null }, { startDate: { [Op.lte]: now } }],
      },
      {
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gte]: now } }],
      },
    ],
  };

  if (city) {
    where[Op.and].push({
      [Op.or]: [{ city: null }, { city: '' }, { city: { [Op.like]: `%${city}%` } }],
    });
  }

  return where;
}
