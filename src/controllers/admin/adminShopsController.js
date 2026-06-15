import { randomUUID } from 'crypto';
import { Shop, ShopCategory } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { toNum } from '../../serializers/formatters.js';

export async function listPending(_req, res, next) {
  try {
    const rows = await Shop.findAll({
      where: { verificationStatus: 'pending' },
      include: [{ model: ShopCategory, as: 'category' }],
      order: [['createdAt', 'DESC']],
    });
    return sendOk(res, rows.map(mapShopAdmin));
  } catch (e) {
    next(e);
  }
}

export async function listShops(_req, res, next) {
  try {
    const rows = await Shop.findAll({
      include: [{ model: ShopCategory, as: 'category' }],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    return sendOk(res, rows.map(mapShopAdmin));
  } catch (e) {
    next(e);
  }
}

export async function approveShop(req, res, next) {
  try {
    const shop = await Shop.findByPk(req.params.id);
    if (!shop) return sendFail(res, 'Shop not found', 404);
    await shop.update({ verificationStatus: 'verified', isActive: true });
    await recordAdminAction(req.adminId, 'shop_approve', { entityType: 'shop', entityId: shop.id });
    return sendOk(res, mapShopAdmin(await shop.reload({ include: [{ model: ShopCategory, as: 'category' }] })));
  } catch (e) {
    next(e);
  }
}

export async function rejectShop(req, res, next) {
  try {
    const shop = await Shop.findByPk(req.params.id);
    if (!shop) return sendFail(res, 'Shop not found', 404);
    await shop.update({ verificationStatus: 'rejected', isActive: false });
    await recordAdminAction(req.adminId, 'shop_reject', {
      entityType: 'shop',
      entityId: shop.id,
      meta: { reason: req.body?.reason },
    });
    return sendOk(res, mapShopAdmin(await shop.reload({ include: [{ model: ShopCategory, as: 'category' }] })));
  } catch (e) {
    next(e);
  }
}

export async function setFeatured(req, res, next) {
  try {
    const shop = await Shop.findByPk(req.params.id);
    if (!shop) return sendFail(res, 'Shop not found', 404);
    await shop.update({ isFeatured: Boolean(req.body?.featured) });
    await recordAdminAction(req.adminId, 'shop_featured', {
      entityType: 'shop',
      entityId: shop.id,
      meta: { featured: shop.isFeatured },
    });
    return sendOk(res, mapShopAdmin(await shop.reload({ include: [{ model: ShopCategory, as: 'category' }] })));
  } catch (e) {
    next(e);
  }
}

export async function leadStats(_req, res, next) {
  try {
    const shops = await Shop.findAll({
      where: { verificationStatus: 'verified' },
      attributes: [
        'id',
        'shopName',
        'callCount',
        'directionsCount',
        'referralCount',
        'clickCount',
        'city',
      ],
      order: [['clickCount', 'DESC']],
      limit: 50,
    });
    const totals = shops.reduce(
      (acc, s) => {
        acc.calls += s.callCount || 0;
        acc.directions += s.directionsCount || 0;
        acc.referrals += s.referralCount || 0;
        acc.clicks += s.clickCount || 0;
        return acc;
      },
      { calls: 0, directions: 0, referrals: 0, clicks: 0 },
    );
    return sendOk(res, {
      totals,
      shops: shops.map((s) => ({
        id: s.id,
        shopName: s.shopName,
        city: s.city,
        callCount: s.callCount || 0,
        directionsCount: s.directionsCount || 0,
        referralCount: s.referralCount || 0,
        clickCount: s.clickCount || 0,
      })),
    });
  } catch (e) {
    next(e);
  }
}

export async function listCategories(_req, res, next) {
  try {
    const rows = await ShopCategory.findAll({ order: [['name', 'ASC']] });
    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function createCategory(req, res, next) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return sendFail(res, 'Name required', 400);
    const id = String(req.body?.id || name.toLowerCase().replace(/\s+/g, '_').slice(0, 64));
    const existing = await ShopCategory.findByPk(id);
    if (existing) return sendFail(res, 'Category id already exists', 400);
    const row = await ShopCategory.create({ id, name, isActive: true });
    await recordAdminAction(req.adminId, 'shop_category_create', { meta: { id } });
    return sendOk(res, row);
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const row = await ShopCategory.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Not found', 404);
    const upd = {};
    if (req.body?.name) upd.name = String(req.body.name).trim();
    if (req.body?.isActive !== undefined) upd.isActive = Boolean(req.body.isActive);
    await row.update(upd);
    return sendOk(res, row);
  } catch (e) {
    next(e);
  }
}

function mapShopAdmin(shop) {
  return {
    id: shop.id,
    shopName: shop.shopName,
    ownerName: shop.ownerName,
    categoryId: shop.categoryId,
    categoryName: shop.category?.name || shop.categoryId,
    phone: shop.phone,
    address: shop.address,
    city: shop.city,
    latitude: shop.latitude != null ? toNum(shop.latitude) : null,
    longitude: shop.longitude != null ? toNum(shop.longitude) : null,
    gstOrLicense: shop.gstOrLicense,
    leadPreference: shop.leadPreference,
    verificationStatus: shop.verificationStatus,
    isFeatured: Boolean(shop.isFeatured),
    isActive: Boolean(shop.isActive),
    rating: toNum(shop.rating),
    callCount: shop.callCount || 0,
    directionsCount: shop.directionsCount || 0,
    referralCount: shop.referralCount || 0,
    clickCount: shop.clickCount || 0,
    createdAt: shop.createdAt,
  };
}
