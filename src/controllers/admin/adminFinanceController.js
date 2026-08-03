import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { AdminUser, StaffProfile, StaffPayroll, Partner, PayoutQueue, Settlement } from '../../models/index.js';
import { sendOk } from '../../utils/apiResponse.js';
import { toNum } from '../../serializers/formatters.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { getSettings } from '../../services/appSettingsService.js';

const PROCESSING_FEE = 10;

export async function listFinancePayouts(_req, res, next) {
  try {
    const settings = await getSettings();
    const threshold = settings.payout_threshold || 500;
    const partners = await Partner.findAll({
      where: { walletBalance: { [Op.gte]: threshold } },
      order: [['walletBalance', 'DESC']],
    });
    const queue = await PayoutQueue.findAll({ where: { status: 'queued' }, order: [['createdAt', 'DESC']] });
    const items = partners.map((p) => {
      const gross = toNum(p.walletBalance);
      const commission = Math.round(gross * 0.1);
      const finalPayout = Math.max(0, gross - commission - PROCESSING_FEE);
      return {
        partnerId: p.id,
        partnerName: p.name,
        totalWorkDone: p.completedJobsCount || p.jobsCompleted || 0,
        grossEarnings: gross,
        kairoCommission: commission,
        processingFee: PROCESSING_FEE,
        finalPayout,
        status: queue.find((q) => q.partnerId === p.id)?.status || 'eligible',
        bankName: p.bankName,
        bankAccount: p.bankAccount,
      };
    });
    return sendOk(res, { threshold, items, queue }, 'ok');
  } catch (e) {
    next(e);
  }
}

export async function generateFinancePayout(req, res, next) {
  try {
    const settings = await getSettings();
    const threshold = settings.payout_threshold || 500;
    const partners = await Partner.findAll({ where: { walletBalance: { [Op.gte]: threshold } } });
    const weekLabel = `monday_${new Date().toISOString().slice(0, 10)}`;
    const rows = [];
    for (const p of partners) {
      const gross = toNum(p.walletBalance);
      const commission = Math.round(gross * 0.1);
      const amount = Math.max(0, gross - commission - PROCESSING_FEE);
      if (amount <= 0) continue;
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
        commissionAmount: commission,
        status: 'pending',
        periodEnd: new Date(),
      });
      await p.update({ walletBalance: gross < threshold ? gross : 0 });
    }
    await recordAdminAction(req.adminId, 'payout_generate', { meta: { count: rows.length, label: 'Monday settlement' }, req });
    const csv = [
      'partner_name,gross,kairo_10pct,processing_fee,final_payout,status',
      ...rows.map((r) => {
        const p = partners.find((x) => x.id === r.partnerId);
        const gross = toNum(p?.walletBalance) + toNum(r.amount);
        const commission = Math.round(gross * 0.1);
        return `${p?.name || r.partnerId},${gross},${commission},${PROCESSING_FEE},${r.amount},queued`;
      }),
    ].join('\n');
    return sendOk(res, { queue: rows, csv, count: rows.length }, 'Monday payout batch generated');
  } catch (e) {
    next(e);
  }
}

export async function markPayoutPaid(req, res, next) {
  try {
    const row = await PayoutQueue.findByPk(req.params.id);
    if (!row) return sendOk(res, null, 'Payout not found', 404);
    await row.update({ status: 'paid' });
    await Settlement.update({ status: 'paid' }, { where: { partnerId: row.partnerId, status: 'pending' } });
    return sendOk(res, row, 'Marked paid');
  } catch (e) {
    next(e);
  }
}

export async function walletHistory(_req, res, next) {
  try {
    const settlements = await Settlement.findAll({ order: [['createdAt', 'DESC']], limit: 100 });
    return sendOk(res, settlements, 'ok');
  } catch (e) {
    next(e);
  }
}

export async function listStaffPayroll(_req, res, next) {
  try {
    const period = new Date().toISOString().slice(0, 7);
    let rows = await StaffPayroll.findAll({ where: { periodLabel: period }, order: [['createdAt', 'DESC']] });
    if (!rows.length) {
      const staff = await StaffProfile.findAll();
      const admins = await AdminUser.findAll({ where: { id: staff.map((s) => s.adminUserId) } });
      const adminMap = new Map(admins.map((a) => [a.id, a]));
      rows = staff.map((s) => {
        const admin = adminMap.get(s.adminUserId);
        const bonus = admin?.role === 'manager' ? 0 : admin?.role === 'hr' ? 0 : 0;
        const total = toNum(s.baseSalary) + bonus;
        return {
          id: `sp_preview_${s.id}`,
          staffProfileId: s.id,
          adminUserId: s.adminUserId,
          staffName: admin?.name || admin?.email,
          designation: s.designation || admin?.role,
          baseSalary: toNum(s.baseSalary),
          performanceBonus: bonus,
          totalPayable: total,
          status: 'pending',
          periodLabel: period,
        };
      });
    }
    return sendOk(res, rows, 'ok');
  } catch (e) {
    next(e);
  }
}

export async function calculateStaffPayroll(req, res, next) {
  try {
    const period = req.body.period || new Date().toISOString().slice(0, 7);
    const staff = await StaffProfile.findAll();
    const created = [];
    for (const s of staff) {
      const admin = await AdminUser.findByPk(s.adminUserId);
      let bonus = 0;
      if (admin?.role === 'manager') bonus = 0;
      if (admin?.role === 'hr') bonus = 0;
      const total = toNum(s.baseSalary) + bonus;
      const row = await StaffPayroll.create({
        id: `sp_${randomUUID().slice(0, 10)}`,
        staffProfileId: s.id,
        adminUserId: s.adminUserId,
        periodLabel: period,
        baseSalary: s.baseSalary,
        performanceBonus: bonus,
        totalPayable: total,
        status: 'pending',
        meta: { designation: s.designation },
      });
      created.push(row);
    }
    await recordAdminAction(req.adminId, 'payroll_calculate', { meta: { period, count: created.length }, req });
    return sendOk(res, created, 'Payroll calculated');
  } catch (e) {
    next(e);
  }
}
