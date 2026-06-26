import { AdvertisementBanner } from '../models/index.js';

/** Assign the next slot in the sequential campaign queue for a placement. */
export async function nextDisplayOrder(placement = 'home_dashboard') {
  const max = await AdvertisementBanner.max('displayOrder', {
    where: { placement },
  });
  const n = Number(max);
  return Number.isFinite(n) ? n + 1 : 0;
}

export const BANNER_QUEUE_ORDER = [
  ['displayOrder', 'ASC'],
  ['priority', 'DESC'],
  ['createdAt', 'ASC'],
];
