import { GeoZone } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { getSettings, updateSettings } from '../../services/appSettingsService.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { randomUUID } from 'crypto';

export async function getAppSettings(_req, res, next) {
  try {
    return sendOk(res, await getSettings());
  } catch (e) {
    next(e);
  }
}

export async function patchAppSettings(req, res, next) {
  try {
    const merged = await updateSettings(req.body, req.adminId);
    await recordAdminAction(req.adminId, 'settings_update', { meta: req.body });
    return sendOk(res, merged, 'Settings updated');
  } catch (e) {
    next(e);
  }
}

export async function listGeoZones(_req, res, next) {
  try {
    return sendOk(res, await GeoZone.findAll({ order: [['city', 'ASC']] }));
  } catch (e) {
    next(e);
  }
}

export async function upsertGeoZone(req, res, next) {
  try {
    const { id, name, city, surgeFee, active, polygon } = req.body;
    if (!name || !city) return sendFail(res, 'name and city required', 400);
    if (id) {
      const z = await GeoZone.findByPk(id);
      if (!z) return sendFail(res, 'Zone not found', 404);
      await z.update({ name, city, surgeFee, active, polygon });
      return sendOk(res, z);
    }
    const z = await GeoZone.create({
      id: `gz_${randomUUID().slice(0, 10)}`,
      name,
      city,
      surgeFee: surgeFee || 0,
      active: active !== false,
      polygon: polygon || null,
    });
    return sendOk(res, z, 'Zone created');
  } catch (e) {
    next(e);
  }
}

export async function setSurge(req, res, next) {
  try {
    const { city, surgeFee } = req.body;
    if (!city) return sendFail(res, 'city required', 400);
    const [z] = await GeoZone.findOrCreate({
      where: { city, name: `${city} default` },
      defaults: {
        id: `gz_${randomUUID().slice(0, 10)}`,
        name: `${city} default`,
        city,
        surgeFee: surgeFee || 0,
        active: true,
      },
    });
    await z.update({ surgeFee: surgeFee ?? z.surgeFee });
    await recordAdminAction(req.adminId, 'surge_update', { entityType: 'geo', entityId: z.id, meta: { city, surgeFee } });
    return sendOk(res, z, 'Surge updated');
  } catch (e) {
    next(e);
  }
}
