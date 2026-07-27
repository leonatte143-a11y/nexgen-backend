import { AppSetting } from '../models/index.js';
import { DEFAULT_VISITING_CHARGE_TIERS } from './money.js';

const DEFAULTS = {
  commission_percent: 10,
  gst_percent: 18,
  surge_fee_default: 0,
  otp_digits: 6,
  visiting_fee: 30,
  visiting_charge_tiers: DEFAULT_VISITING_CHARGE_TIERS,
  partner_price_min: 100,
  partner_price_max: 1000,
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

const MAPS_KEY_SETTING = 'google_maps_api_key';

export async function getMapsKeySetting() {
  const row = await AppSetting.findOne({ where: { settingKey: MAPS_KEY_SETTING } });
  if (!row) return { apiKey: null, updatedBy: null, updatedAt: null };
  const v = row.settingValue || {};
  return { apiKey: v.apiKey || null, updatedBy: v.updatedBy || null, updatedAt: row.updatedAt };
}

export async function setMapsKeySetting(apiKey, adminId) {
  const value = { apiKey, updatedBy: adminId };
  const [row] = await AppSetting.findOrCreate({
    where: { settingKey: MAPS_KEY_SETTING },
    defaults: { id: 'settings_maps_key', settingKey: MAPS_KEY_SETTING, settingValue: value },
  });
  await row.update({ settingValue: value });
  return { apiKey, updatedBy: adminId, updatedAt: row.updatedAt };
}
