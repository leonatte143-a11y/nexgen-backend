import { AppSetting } from '../models/index.js';

const DEFAULTS = {
  commission_percent: 10,
  gst_percent: 18,
  surge_fee_default: 0,
  otp_digits: 6,
  visiting_fee: 30,
  payout_threshold: 500,
  cities: ['Rajahmundry', 'Guntur'],
};

export async function getSettings() {
  const rows = await AppSetting.findAll();
  const out = { ...DEFAULTS };
  for (const r of rows) {
    const v = r.settingValue;
    if (r.settingKey === 'global' && typeof v === 'object') Object.assign(out, v);
    else out[r.settingKey] = v;
  }
  return out;
}

export async function updateSettings(patch, adminId) {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  const [row] = await AppSetting.findOrCreate({
    where: { settingKey: 'global' },
    defaults: { id: 'settings_global', settingKey: 'global', settingValue: merged },
  });
  await row.update({ settingValue: merged });
  return merged;
}
