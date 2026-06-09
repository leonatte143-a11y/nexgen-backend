import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { EmergencyRequest, User, Partner } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';
import { getSettings } from '../services/appSettingsService.js';
import { haversineKm } from '../utils/haversine.js';

const DEFAULT_DISPATCH = '108';

export async function createEmergencyRequest(req, res, next) {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return sendFail(res, 'User not found', 404);
    const { latitude, longitude, notes } = req.body;
    const settings = await getSettings();
    const dispatchPhone = String(settings.emergency_dispatch_phone || DEFAULT_DISPATCH).replace(/\D/g, '');

    const row = await EmergencyRequest.create({
      id: `er_${randomUUID().slice(0, 12)}`,
      userId: user.id,
      userPhone: user.phone,
      latitude: latitude != null ? latitude : user.latitude,
      longitude: longitude != null ? longitude : user.longitude,
      status: 'open',
      dispatchPhone,
      notes: notes || null,
    });

    if (latitude != null && longitude != null) {
      await user.update({ latitude, longitude });
    }

    return sendOk(
      res,
      {
        id: row.id,
        dispatchPhone,
        telUrl: `tel:+91${dispatchPhone}`,
        latitude: row.latitude,
        longitude: row.longitude,
      },
      'Emergency alert sent',
    );
  } catch (e) {
    next(e);
  }
}

export async function listPartnerEmergencies(req, res, next) {
  try {
    const partner = await Partner.findByPk(req.partnerId);
    if (!partner) return sendFail(res, 'Partner not found', 404);
    const lat = Number(partner?.latitude);
    const lng = Number(partner?.longitude);
    const radiusKm = 5;

    const rows = await EmergencyRequest.findAll({
      where: { status: 'open' },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    const items = rows
      .map((r) => {
        const rLat = Number(r.latitude);
        const rLng = Number(r.longitude);
        let distanceKm = null;
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(rLat) && Number.isFinite(rLng)) {
          distanceKm = haversineKm(lat, lng, rLat, rLng);
        }
        return {
          id: r.id,
          userPhone: r.userPhone,
          latitude: r.latitude,
          longitude: r.longitude,
          distanceKm,
          createdAt: r.createdAt,
          notes: r.notes,
        };
      })
      .filter((r) => r.distanceKm == null || r.distanceKm <= radiusKm);

    return sendOk(res, items, 'ok');
  } catch (e) {
    next(e);
  }
}

export async function listOpenEmergencies(_req, res, next) {
  try {
    const rows = await EmergencyRequest.findAll({
      where: { status: 'open', createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    return sendOk(res, rows, 'ok');
  } catch (e) {
    next(e);
  }
}
