import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { Category, Service, Partner } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toCatalogService, toServiceBucket } from '../../serializers/mappers.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { toNum } from '../../serializers/formatters.js';

const CATALOG_PARTNER_ID = 'partner_kairo_catalog';

async function ensureCatalogPartner() {
  const [partner] = await Partner.findOrCreate({
    where: { id: CATALOG_PARTNER_ID },
    defaults: {
      id: CATALOG_PARTNER_ID,
      phone: '0000000001',
      name: 'KAIRO Catalog',
      photoUrl: '',
      rating: 5,
      jobsCompleted: 0,
      isOnline: false,
      skills: [],
      categories: [],
      walletBalance: 0,
      verificationStatus: 'Verified',
      primaryCity: 'System',
    },
  });
  return partner;
}

export async function listCategories(_req, res, next) {
  try {
    const rows = await Category.findAll({
      where: { isActive: { [Op.ne]: false } },
      order: [['id', 'ASC']],
    });
    return sendOk(res, rows.map(toServiceBucket));
  } catch (e) {
    next(e);
  }
}

export async function createCategory(req, res, next) {
  try {
    const { id, nameEn, nameTe, emoji, iconUrl, minPrice, maxPrice, isActive } = req.body;
    if (!nameEn?.trim()) return sendFail(res, 'Category name is required', 400);
    const slug = id || `cat_${randomUUID().slice(0, 10)}`;
    const existing = await Category.findByPk(slug);
    if (existing) return sendFail(res, 'Category id already exists', 409);

    const c = await Category.create({
      id: slug,
      nameEn: String(nameEn).trim(),
      nameTe: nameTe?.trim() || nameEn,
      emoji: emoji || '•',
      iconUrl: iconUrl || null,
      minPrice: minPrice != null ? minPrice : null,
      maxPrice: maxPrice != null ? maxPrice : null,
      isActive: isActive !== false,
    });
    await recordAdminAction(req.adminId, 'category_create', { entityType: 'category', entityId: c.id, req });
    return sendOk(res, toServiceBucket(c), 'Category created');
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const c = await Category.findByPk(req.params.id);
    if (!c) return sendFail(res, 'Category not found', 404);
    const { nameEn, nameTe, emoji, iconUrl, minPrice, maxPrice, isActive } = req.body;
    await c.update({
      nameEn: nameEn ?? c.nameEn,
      nameTe: nameTe ?? c.nameTe,
      emoji: emoji ?? c.emoji,
      iconUrl: iconUrl !== undefined ? iconUrl : c.iconUrl,
      minPrice: minPrice !== undefined ? minPrice : c.minPrice,
      maxPrice: maxPrice !== undefined ? maxPrice : c.maxPrice,
      isActive: isActive !== undefined ? Boolean(isActive) : c.isActive,
    });
    await recordAdminAction(req.adminId, 'category_update', { entityType: 'category', entityId: c.id, req });
    return sendOk(res, toServiceBucket(c));
  } catch (e) {
    next(e);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const c = await Category.findByPk(req.params.id);
    if (!c) return sendFail(res, 'Category not found', 404);
    const activeCount = await Service.count({
      where: { categoryId: c.id, isActive: { [Op.ne]: false } },
    });
    if (activeCount > 0) {
      return sendFail(
        res,
        `Cannot delete category with ${activeCount} active service(s). Remove or reassign them first.`,
        409,
      );
    }
    await c.update({ isActive: false });
    await recordAdminAction(req.adminId, 'category_delete', { entityType: 'category', entityId: c.id, req });
    return sendOk(res, { id: c.id, deleted: true }, 'Category deleted');
  } catch (e) {
    next(e);
  }
}

export async function listServicesAdmin(_req, res, next) {
  try {
    const rows = await Service.findAll({
      where: { isActive: { [Op.ne]: false } },
      include: [{ model: Partner, as: 'partner' }, { model: Category, as: 'category' }],
      order: [['name', 'ASC']],
    });
    return sendOk(
      res,
      rows.map((s) => ({
        ...toCatalogService(s),
        commissionPercent: toNum(s.commissionPercent) || 10,
        premiumPrice: s.premiumPrice != null ? toNum(s.premiumPrice) : toNum(s.basePrice),
        categoryId: s.categoryId,
        isActive: s.isActive !== false,
        customFields: s.customFields || [],
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function createCatalogService(req, res, next) {
  try {
    const { categoryId, name, basePrice, commissionPercent, subtext, description, customFields } = req.body;
    if (!categoryId || !name?.trim()) {
      return sendFail(res, 'categoryId and service name are required', 400);
    }
    const category = await Category.findByPk(categoryId);
    if (!category) return sendFail(res, 'Category not found', 404);
    if (category.isActive === false) {
      return sendFail(res, 'Category is inactive', 400);
    }

    const partner = await ensureCatalogPartner();
    const id = `svc_${randomUUID().slice(0, 12)}`;
    const s = await Service.create({
      id,
      categoryId,
      partnerId: partner.id,
      name: String(name).trim(),
      subtext: subtext?.trim() || name,
      categoryLabel: category.nameEn,
      basePrice: basePrice != null ? basePrice : 0,
      commissionPercent: commissionPercent != null ? commissionPercent : 10,
      description: description || '',
      customFields: Array.isArray(customFields) && customFields.length ? customFields : null,
      isActive: true,
    });
    const full = await Service.findByPk(s.id, {
      include: [{ model: Partner, as: 'partner' }, { model: Category, as: 'category' }],
    });
    await recordAdminAction(req.adminId, 'service_create', {
      entityType: 'service',
      entityId: s.id,
      meta: { name: s.name, basePrice: s.basePrice },
      req,
    });
    return sendOk(
      res,
      {
        ...toCatalogService(full),
        commissionPercent: toNum(full.commissionPercent) || 10,
        customFields: full.customFields || [],
      },
      'Service created',
    );
  } catch (e) {
    next(e);
  }
}

export async function updateService(req, res, next) {
  try {
    const s = await Service.findByPk(req.params.id, { include: [{ model: Partner, as: 'partner' }] });
    if (!s) return sendFail(res, 'Service not found', 404);
    const { basePrice, premiumPrice, name, subtext, categoryLabel, commissionPercent, description, isActive, customFields } = req.body;
    await s.update({
      basePrice: basePrice != null ? basePrice : s.basePrice,
      premiumPrice: premiumPrice !== undefined ? premiumPrice : s.premiumPrice,
      name: name ?? s.name,
      subtext: subtext ?? s.subtext,
      categoryLabel: categoryLabel ?? s.categoryLabel,
      commissionPercent: commissionPercent ?? s.commissionPercent,
      description: description ?? s.description,
      customFields: customFields !== undefined ? customFields : s.customFields,
      isActive: isActive !== undefined ? Boolean(isActive) : s.isActive,
    });
    await recordAdminAction(req.adminId, 'service_price_update', {
      entityType: 'service',
      entityId: s.id,
      meta: { basePrice: s.basePrice },
      req,
    });
    return sendOk(res, { ...toCatalogService(s), commissionPercent: toNum(s.commissionPercent) });
  } catch (e) {
    next(e);
  }
}
