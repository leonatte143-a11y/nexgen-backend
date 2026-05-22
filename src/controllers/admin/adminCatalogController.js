import { Category, Service, Partner } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toCatalogService, toServiceBucket } from '../../serializers/mappers.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { toNum } from '../../serializers/formatters.js';

export async function listCategories(_req, res, next) {
  try {
    const rows = await Category.findAll({ order: [['id', 'ASC']] });
    return sendOk(res, rows.map(toServiceBucket));
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const c = await Category.findByPk(req.params.id);
    if (!c) return sendFail(res, 'Category not found', 404);
    const { nameEn, nameTe, emoji } = req.body;
    await c.update({
      nameEn: nameEn ?? c.nameEn,
      nameTe: nameTe ?? c.nameTe,
      emoji: emoji ?? c.emoji,
    });
    await recordAdminAction(req.adminId, 'category_update', { entityType: 'category', entityId: c.id });
    return sendOk(res, toServiceBucket(c));
  } catch (e) {
    next(e);
  }
}

export async function listServicesAdmin(_req, res, next) {
  try {
    const rows = await Service.findAll({
      include: [{ model: Partner, as: 'partner' }, { model: Category, as: 'category' }],
    });
    return sendOk(
      res,
      rows.map((s) => ({
        ...toCatalogService(s),
        commissionPercent: toNum(s.commissionPercent) || 10,
        categoryId: s.categoryId,
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function updateService(req, res, next) {
  try {
    const s = await Service.findByPk(req.params.id, { include: [{ model: Partner, as: 'partner' }] });
    if (!s) return sendFail(res, 'Service not found', 404);
    const { basePrice, name, subtext, categoryLabel, commissionPercent, description } = req.body;
    await s.update({
      basePrice: basePrice != null ? basePrice : s.basePrice,
      name: name ?? s.name,
      subtext: subtext ?? s.subtext,
      categoryLabel: categoryLabel ?? s.categoryLabel,
      commissionPercent: commissionPercent ?? s.commissionPercent,
      description: description ?? s.description,
    });
    await recordAdminAction(req.adminId, 'service_price_update', {
      entityType: 'service',
      entityId: s.id,
      meta: { basePrice: s.basePrice },
    });
    return sendOk(res, { ...toCatalogService(s), commissionPercent: toNum(s.commissionPercent) });
  } catch (e) {
    next(e);
  }
}
