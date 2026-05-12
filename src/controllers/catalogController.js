import { Category, Service, Partner } from '../models/index.js';
import { sendOk } from '../utils/apiResponse.js';
import { toCatalogService, toServiceBucket } from '../serializers/mappers.js';

export async function getBuckets(req, res, next) {
  try {
    const rows = await Category.findAll({ order: [['id', 'ASC']] });
    return sendOk(res, rows.map(toServiceBucket));
  } catch (e) {
    next(e);
  }
}

export async function getCatalog(req, res, next) {
  try {
    const rows = await Service.findAll({
      include: [{ model: Partner, as: 'partner' }],
      order: [['name', 'ASC']],
    });
    return sendOk(res, rows.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function getByBucket(req, res, next) {
  try {
    const { bucketId } = req.params;
    const rows = await Service.findAll({
      where: { categoryId: bucketId },
      include: [{ model: Partner, as: 'partner' }],
    });
    return sendOk(res, rows.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function getById(req, res, next) {
  try {
    const row = await Service.findByPk(req.params.id, {
      include: [{ model: Partner, as: 'partner' }],
    });
    return sendOk(res, row ? toCatalogService(row) : null);
  } catch (e) {
    next(e);
  }
}

export async function search(req, res, next) {
  try {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase();
    const rows = await Service.findAll({
      include: [{ model: Partner, as: 'partner' }],
    });
    const filtered = !q
      ? rows
      : rows.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.categoryLabel.toLowerCase().includes(q) ||
            (s.subtext && s.subtext.toLowerCase().includes(q)),
        );
    return sendOk(res, filtered.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}

export async function topRated(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const rows = await Service.findAll({
      include: [{ model: Partner, as: 'partner' }],
    });
    const sorted = [...rows].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, limit);
    return sendOk(res, sorted.map(toCatalogService));
  } catch (e) {
    next(e);
  }
}
