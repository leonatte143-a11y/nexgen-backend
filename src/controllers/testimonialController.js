import { randomInt } from 'crypto';
import { Testimonial } from '../models/index.js';
import { sendOk, sendFail } from '../utils/apiResponse.js';

export async function listPartnerTestimonials(req, res, next) {
  try {
    const partnerId = req.params.id;
    const rows = await Testimonial.findAll({
      where: { partnerId },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return sendOk(
      res,
      rows.map((t) => ({
        id: t.id,
        userId: t.userId,
        partnerId: t.partnerId,
        videoUrl: t.videoUrl,
        createdAt: t.createdAt,
      })),
    );
  } catch (e) {
    next(e);
  }
}

export async function createTestimonial(req, res, next) {
  try {
    const { partnerId, videoUrl } = req.body || {};
    const pid = String(partnerId || '').trim();
    const url = String(videoUrl || '').trim();
    if (!pid) return sendFail(res, 'partnerId required', 400);
    if (!url) return sendFail(res, 'videoUrl required', 400);

    const t = await Testimonial.create({
      id: `tst_${Date.now()}_${randomInt(100, 1000)}`,
      userId: req.userId,
      partnerId: pid,
      videoUrl: url,
    });
    return sendOk(res, { id: t.id, userId: t.userId, partnerId: t.partnerId, videoUrl: t.videoUrl }, 'Testimonial created', 201);
  } catch (e) {
    next(e);
  }
}

