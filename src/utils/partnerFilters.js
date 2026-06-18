/** Shared filter — partners visible on the live platform */
import { Op } from 'sequelize';

export const LIVE_PARTNER_WHERE = {
  archivedAt: null,
  isBlocked: false,
  accountStatus: { [Op.ne]: 'archived' },
};

export function isLivePartner(partner) {
  if (!partner) return false;
  if (partner.archivedAt) return false;
  if (partner.isBlocked) return false;
  if (partner.accountStatus === 'archived') return false;
  return true;
}
