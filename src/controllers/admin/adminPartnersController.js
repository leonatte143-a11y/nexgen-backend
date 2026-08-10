import { Op } from 'sequelize';
import { randomUUID } from 'crypto';
import { Partner, PartnerDocument, Notification, Booking, Category } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toPartnerProfile } from '../../serializers/mappers.js';
import { toNum } from '../../serializers/formatters.js';
import { recordAdminAction } from '../../utils/auditLog.js';

function slugifyCategoryName(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `cat_${base || randomUUID().slice(0, 8)}_${randomUUID().slice(0, 6)}`;
}

async function applyPartnerApproval(partner) {
  await partner.update({ verificationStatus: 'Verified' });
  await PartnerDocument.update({ status: 'approved' }, { where: { partnerId: partner.id } });
  await Notification.create({
    id: `n_${randomUUID().slice(0, 10)}`,
    userId: null,
    type: 'partner',
    title: 'KYC Approved',
    body: 'Congratulations! You are now a KAIRO Partner.',
    read: false,
    timeLabel: 'now',
  });
}

export async function listPartners(req, res, next) {
  try {
    const { q, status, online, includeArchived } = req.query;
    const where = {};
    if (includeArchived !== 'true') {
      where.archivedAt = null;
      where.accountStatus = { [Op.ne]: 'archived' };
    }
    if (status) where.verificationStatus = status;
    if (online === 'true') where.isOnline = true;
    if (online === 'false') where.isOnline = false;
    let rows = await Partner.findAll({ where, order: [['updatedAt', 'DESC']] });
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(
        (p) => p.name?.toLowerCase().includes(s) || p.phone?.includes(s) || p.id.includes(s),
      );
    }
    return sendOk(
      res,
      rows.map((p) => ({
        ...toPartnerProfile(p),
        walletBalance: toNum(p.walletBalance),
        strikeCount: p.strikeCount,
        isOnline: p.isOnline,
        categories: p.categories,
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function listPendingKyc(_req, res, next) {
  try {
    const rows = await Partner.findAll({
      where: {
        verificationStatus: { [Op.in]: ['Pending', 'pending', 'Rejected'] },
        archivedAt: null,
        accountStatus: { [Op.ne]: 'archived' },
      },
      order: [['createdAt', 'ASC']],
    });
    const docs = await PartnerDocument.findAll();
    const byPartner = new Map();
    for (const d of docs) {
      if (!byPartner.has(d.partnerId)) byPartner.set(d.partnerId, []);
      byPartner.get(d.partnerId).push(d);
    }
    const payload = rows.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      categories: p.categories,
      skills: p.skills,
      verificationStatus: p.verificationStatus,
      photoUrl: p.photoUrl,
      customCategoryRequest: p.customCategoryRequest || null,
      documents: (byPartner.get(p.id) || []).map((d) => ({
        id: d.id,
        docType: d.docType,
        fileUrl: d.fileUrl,
        status: d.status,
      })),
    }));
    return sendOk(res, payload, 'ok', 200);
  } catch (e) {
    next(e);
  }
}

export async function getPartnerKyc(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    const documents = await PartnerDocument.findAll({ where: { partnerId: p.id } });
    return sendOk(res, { partner: toPartnerProfile(p), documents });
  } catch (e) {
    next(e);
  }
}

export async function approveKyc(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    await p.update({ verificationStatus: 'Verified' });
    await PartnerDocument.update({ status: 'approved' }, { where: { partnerId: p.id } });
    await Notification.create({
      id: `n_${randomUUID().slice(0, 10)}`,
      userId: null,
      type: 'partner',
      title: 'KYC Approved',
      body: 'Congratulations! You are now a KAIRO Partner.',
      read: false,
      timeLabel: 'now',
    });
    await recordAdminAction(req.adminId, 'kyc_approve', { entityType: 'partner', entityId: p.id });
    return sendOk(res, toPartnerProfile(p), 'Partner approved');
  } catch (e) {
    next(e);
  }
}

export async function approveKycAddCategory(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    const requestedName = (p.customCategoryRequest || '').trim();
    if (!requestedName) {
      return sendFail(res, 'This partner has no custom category request', 400);
    }
    const category = await Category.create({
      id: slugifyCategoryName(requestedName),
      nameEn: requestedName,
      nameTe: requestedName,
      emoji: '•',
      iconUrl: null,
      minPrice: null,
      maxPrice: null,
      isActive: true,
    });
    await applyPartnerApproval(p);
    const existingCategories = Array.isArray(p.categories) ? p.categories : [];
    const nextCategories = existingCategories.includes(category.id)
      ? existingCategories
      : [...existingCategories, category.id];
    await p.update({ categories: nextCategories });
    await recordAdminAction(req.adminId, 'kyc_approve_add_category', {
      entityType: 'partner',
      entityId: p.id,
      meta: { categoryId: category.id, categoryName: category.nameEn },
    });
    return sendOk(res, { partner: toPartnerProfile(p), category }, 'Partner approved and category added');
  } catch (e) {
    next(e);
  }
}

export async function approveKycMapCategory(req, res, next) {
  try {
    const { categoryId } = req.body;
    if (!categoryId) return sendFail(res, 'categoryId is required', 400);
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    const category = await Category.findByPk(categoryId);
    if (!category) return sendFail(res, 'Category not found', 404);
    await applyPartnerApproval(p);
    const existingCategories = Array.isArray(p.categories) ? p.categories : [];
    const nextCategories = existingCategories.includes(category.id)
      ? existingCategories
      : [...existingCategories, category.id];
    await p.update({ categories: nextCategories });
    await recordAdminAction(req.adminId, 'kyc_approve_map_category', {
      entityType: 'partner',
      entityId: p.id,
      meta: { categoryId: category.id },
    });
    return sendOk(res, { partner: toPartnerProfile(p), category }, 'Partner approved and mapped to category');
  } catch (e) {
    next(e);
  }
}

export async function rejectKyc(req, res, next) {
  try {
    const { reason } = req.body;
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    await p.update({ verificationStatus: 'Rejected' });
    await recordAdminAction(req.adminId, 'kyc_reject', {
      entityType: 'partner',
      entityId: p.id,
      meta: { reason },
    });
    return sendOk(res, toPartnerProfile(p), 'Partner rejected');
  } catch (e) {
    next(e);
  }
}

export async function updatePartner(req, res, next) {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return sendFail(res, 'Partner not found', 404);
    const allowed = [
      'isOnline',
      'strikeCount',
      'verificationStatus',
      'walletBalance',
      'shadowBanned',
    ];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    if (req.body.shadowBanned === true) {
      patch.strikeCount = Math.max(p.strikeCount, 1);
    }
    await p.update(patch);
    await recordAdminAction(req.adminId, 'partner_update', { entityType: 'partner', entityId: p.id, meta: patch });
    return sendOk(res, toPartnerProfile(p));
  } catch (e) {
    next(e);
  }
}

export async function uploadPartnerDocument(req, res, next) {
  try {
    const { docType, fileUrl } = req.body;
    if (!docType || !fileUrl) return sendFail(res, 'docType and fileUrl required', 400);
    const doc = await PartnerDocument.create({
      id: `doc_${randomUUID().slice(0, 10)}`,
      partnerId: req.params.id,
      docType,
      fileUrl,
      status: 'pending',
    });
    return sendOk(res, doc, 'Document saved');
  } catch (e) {
    next(e);
  }
}
