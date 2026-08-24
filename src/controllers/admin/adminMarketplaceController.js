import { randomUUID } from 'crypto';
import { MarketplaceListing, MarketplaceReport, User, Partner, Notification } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';

async function attachSellerInfo(rows) {
  const userIds = rows.filter((r) => r.sellerRole === 'user').map((r) => r.sellerId);
  const partnerIds = rows.filter((r) => r.sellerRole === 'partner').map((r) => r.sellerId);
  const [users, partners] = await Promise.all([
    userIds.length ? User.findAll({ where: { id: userIds } }) : [],
    partnerIds.length ? Partner.findAll({ where: { id: partnerIds } }) : [],
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const partnerMap = new Map(partners.map((p) => [p.id, p]));
  return rows.map((r) => {
    const json = r.toJSON();
    if (r.sellerRole === 'user') {
      const u = userMap.get(r.sellerId);
      json.sellerName = u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || null : null;
      json.sellerPhone = u?.phone || null;
    } else {
      const p = partnerMap.get(r.sellerId);
      json.sellerName = p?.name || null;
      json.sellerPhone = p?.phone || null;
    }
    return json;
  });
}

export async function adminListListings(req, res, next) {
  try {
    const { status, moderationStatus } = req.query;
    const where = {};
    if (status) where.status = status;
    if (moderationStatus) where.moderationStatus = moderationStatus;
    const rows = await MarketplaceListing.findAll({ where, order: [['createdAt', 'DESC']], limit: 200 });
    return sendOk(res, await attachSellerInfo(rows));
  } catch (e) {
    next(e);
  }
}

export async function adminListReports(_req, res, next) {
  try {
    const rows = await MarketplaceReport.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function adminBanListing(req, res, next) {
  try {
    const listing = await MarketplaceListing.findByPk(req.params.id);
    if (!listing) return sendFail(res, 'Listing not found', 404);

    await listing.update({ status: 'banned' });

    const alsoBanSeller = req.body?.banSeller === true;
    if (alsoBanSeller) {
      if (listing.sellerRole === 'user') {
        await User.update({ isBlocked: true }, { where: { id: listing.sellerId } });
      } else {
        await Partner.update({ isBlocked: true }, { where: { id: listing.sellerId } });
      }
    }

    await recordAdminAction(req.adminId, 'marketplace_listing_ban', {
      entityType: 'marketplace_listing',
      entityId: listing.id,
      meta: {
        label: `Banned marketplace listing: ${listing.title}`,
        sellerBanned: alsoBanSeller,
      },
    });

    return sendOk(res, listing, 'Listing banned');
  } catch (e) {
    next(e);
  }
}

export async function adminApproveListing(req, res, next) {
  try {
    const listing = await MarketplaceListing.findByPk(req.params.id);
    if (!listing) return sendFail(res, 'Listing not found', 404);

    await listing.update({ moderationStatus: 'approved', rejectionReason: null });

    await Notification.create({
      id: `n_${randomUUID().slice(0, 10)}`,
      userId: listing.sellerRole === 'user' ? listing.sellerId : null,
      partnerId: listing.sellerRole === 'partner' ? listing.sellerId : null,
      type: 'marketplace',
      title: 'Listing approved',
      body: `Your listing "${listing.title}" is now live on the marketplace.`,
      read: false,
      timeLabel: 'now',
      payload: { listingId: listing.id },
    }).catch(() => {});

    await recordAdminAction(req.adminId, 'marketplace_listing_approve', {
      entityType: 'marketplace_listing',
      entityId: listing.id,
      meta: { label: `Approved marketplace listing: ${listing.title}` },
    });

    return sendOk(res, listing, 'Listing approved');
  } catch (e) {
    next(e);
  }
}

export async function adminRejectListing(req, res, next) {
  try {
    const listing = await MarketplaceListing.findByPk(req.params.id);
    if (!listing) return sendFail(res, 'Listing not found', 404);

    const reason = String(req.body?.reason || '').slice(0, 500) || null;
    await listing.update({ moderationStatus: 'rejected', rejectionReason: reason });

    await Notification.create({
      id: `n_${randomUUID().slice(0, 10)}`,
      userId: listing.sellerRole === 'user' ? listing.sellerId : null,
      partnerId: listing.sellerRole === 'partner' ? listing.sellerId : null,
      type: 'marketplace',
      title: 'Listing needs changes',
      body: reason ? `Your listing "${listing.title}" was rejected: ${reason}` : `Your listing "${listing.title}" was rejected.`,
      read: false,
      timeLabel: 'now',
      payload: { listingId: listing.id, reason },
    }).catch(() => {});

    await recordAdminAction(req.adminId, 'marketplace_listing_reject', {
      entityType: 'marketplace_listing',
      entityId: listing.id,
      meta: { label: `Rejected marketplace listing: ${listing.title}`, reason },
    });

    return sendOk(res, listing, 'Listing rejected');
  } catch (e) {
    next(e);
  }
}

export async function adminDeleteListing(req, res, next) {
  try {
    const listing = await MarketplaceListing.findByPk(req.params.id);
    if (!listing) return sendFail(res, 'Listing not found', 404);
    await listing.destroy();
    await recordAdminAction(req.adminId, 'marketplace_listing_delete', {
      entityType: 'marketplace_listing',
      entityId: req.params.id,
      meta: { label: `Deleted marketplace listing: ${listing.title}` },
    });
    return sendOk(res, { id: req.params.id }, 'Listing deleted');
  } catch (e) {
    next(e);
  }
}
