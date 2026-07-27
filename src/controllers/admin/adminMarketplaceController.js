import { MarketplaceListing, MarketplaceReport, User, Partner } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';

export async function adminListListings(req, res, next) {
  try {
    const status = req.query.status;
    const where = status ? { status } : {};
    const rows = await MarketplaceListing.findAll({ where, order: [['createdAt', 'DESC']], limit: 200 });
    return sendOk(res, rows);
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
