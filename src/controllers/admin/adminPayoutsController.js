import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { Partner, PayoutQueue, Settlement } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { toNum } from '../../serializers/formatters.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { getSettings } from '../../services/appSettingsService.js';

export async function payoutQueue(_req, res, next) {
  try {
    const settings = await getSettings();
    const threshold = settings.payout_threshold || 500;
    const partners = await Partner.findAll({
      where: { walletBalance: { [Op.gte]: threshold } },
      order: [['walletBalance', 'DESC']],
    });
    const queued = await PayoutQueue.findAll({ where: { status: 'queued' }, order: [['createdAt', 'DESC']] });
    const pending = await PayoutQueue.findAll({ where: { status: 'pending' }, order: [['createdAt', 'DESC']] });
    return sendOk(res, {
      threshold,
      partners: partners.map((p) => ({
        id: p.id,
        name: p.name,
        walletBalance: toNum(p.walletBalance),
        bankName: p.bankName,
        bankAccount: p.bankAccount,
        eligible: true,
      })),
      queue: queued,
      pendingRequests: pending,
    });
  } catch (e) {
    next(e);
  }
}

export async function generatePayoutFile(req, res, next) {
  try {
    const settings = await getSettings();
    const threshold = settings.payout_threshold || 500;
    const partners = await Partner.findAll({ where: { walletBalance: { [Op.gte]: threshold } } });
    const weekLabel = `week_${new Date().toISOString().slice(0, 10)}`;
    const rows = [];
    for (const p of partners) {
      const amount = toNum(p.walletBalance);
      const id = `pq_${randomUUID().slice(0, 10)}`;
      const row = await PayoutQueue.create({
        id,
        partnerId: p.id,
        amount,
        bankName: p.bankName,
        bankAccount: p.bankAccount,
        status: 'queued',
        weekLabel,
      });
      rows.push(row);
      await Settlement.create({
        id: `st_${randomUUID().slice(0, 10)}`,
        partnerId: p.id,
        amount,
        commissionAmount: Math.round(amount * 0.1 * 100) / 100,
        status: 'pending',
        periodEnd: new Date(),
      });
    }
    await recordAdminAction(req.adminId, 'payout_generate', { meta: { count: rows.length } });
    const csv = [
      'partner_id,partner_name,bank_name,bank_account,amount',
      ...rows.map((r) => {
        const p = partners.find((x) => x.id === r.partnerId);
        return `${r.partnerId},${p?.name || ''},${r.bankName || ''},${r.bankAccount || ''},${r.amount}`;
      }),
    ].join('\n');
    return sendOk(res, { queue: rows, csv, count: rows.length }, 'Payout file generated');
  } catch (e) {
    next(e);
  }
}

export async function settlementHistory(_req, res, next) {
  try {
    const rows = await Settlement.findAll({ order: [['createdAt', 'DESC']], limit: 100 });
    return sendOk(res, rows);
  } catch (e) {
    next(e);
  }
}

export async function commissionReport(_req, res, next) {
  try {
    const settlements = await Settlement.findAll();
    const totalCommission = settlements.reduce((s, r) => s + toNum(r.commissionAmount), 0);
    return sendOk(res, {
      totalCommission,
      gstEstimate: Math.round(totalCommission * 0.18),
      settlementsCount: settlements.length,
      invoicePlaceholder: true,
    });
  } catch (e) {
    next(e);
  }
}

export async function approvePayoutRequest(req, res, next) {
  try {
    const row = await PayoutQueue.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Payout not found', 404);
    if (row.status !== 'pending') return sendFail(res, 'Only pending partner withdrawals can be approved', 400);
    await row.update({ status: 'paid' });
    await Settlement.create({
      id: `st_${randomUUID().slice(0, 10)}`,
      partnerId: row.partnerId,
      amount: toNum(row.amount),
      commissionAmount: 0,
      status: 'paid',
      periodEnd: new Date(),
    });
    await recordAdminAction(req.adminId, 'payout_approve', { meta: { payoutId: row.id, amount: row.amount } });
    return sendOk(res, row, 'Withdrawal approved and marked paid');
  } catch (e) {
    next(e);
  }
}

export async function rejectPayoutRequest(req, res, next) {
  try {
    const row = await PayoutQueue.findByPk(req.params.id);
    if (!row) return sendFail(res, 'Payout not found', 404);
    if (row.status !== 'pending') return sendFail(res, 'Only pending partner withdrawals can be rejected', 400);
    const p = await Partner.findByPk(row.partnerId);
    if (p) {
      await p.update({ walletBalance: toNum(p.walletBalance) + toNum(row.amount) });
    }
    await row.update({ status: 'rejected' });
    await recordAdminAction(req.adminId, 'payout_reject', { meta: { payoutId: row.id, amount: row.amount } });
    return sendOk(res, row, 'Withdrawal rejected — amount returned to partner wallet');
  } catch (e) {
    next(e);
  }
}
