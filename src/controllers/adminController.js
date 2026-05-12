import { Category, Service, User, Partner } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { toCatalogService, toServiceBucket } from '../serializers/mappers.js';

export async function createCategory(req, res, next) {
  try {
    const { id, nameEn, nameTe, emoji } = req.body;
    if (!id || !nameEn) return sendFail(res, 'id and nameEn required', 400);
    const c = await Category.create({ id, nameEn, nameTe: nameTe || nameEn, emoji: emoji || '•' });
    return sendOk(res, toServiceBucket(c), 'Category created');
  } catch (e) {
    next(e);
  }
}

export async function createService(req, res, next) {
  try {
    const {
      id,
      categoryId,
      partnerId,
      name,
      subtext = '',
      categoryLabel,
      basePrice,
      rating = 4.5,
      reviewsCount = 0,
      description = '',
      distanceKm = 0,
    } = req.body;
    if (!id || !categoryId || !partnerId || !name) {
      return sendFail(res, 'id, categoryId, partnerId, name required', 400);
    }
    const s = await Service.create({
      id,
      categoryId,
      partnerId,
      name,
      subtext,
      categoryLabel: categoryLabel || name,
      basePrice,
      rating,
      reviewsCount,
      description,
      distanceKm,
    });
    const full = await Service.findByPk(s.id, { include: [{ model: Partner, as: 'partner' }] });
    return sendOk(res, toCatalogService(full), 'Service created');
  } catch (e) {
    next(e);
  }
}

export async function listAllServices(req, res, next) {
  try {
    const rows = await Service.findAll({ include: [{ model: Partner, as: 'partner' }] });
    return sendOk(res, rows.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function listUsers(_req, res, next) {
  try {
    const rows = await User.findAll({
      attributes: ['id', 'phone', 'firstName', 'lastName', 'email', 'createdAt'],
    });
    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}
