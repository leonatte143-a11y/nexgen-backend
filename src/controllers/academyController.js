import { AcademyVideo } from '../models/index.js';
import { sendOk } from '../utils/apiResponse.js';

export async function listAcademyVideos(req, res, next) {
  try {
    const rows = await AcademyVideo.findAll({ order: [['createdAt', 'DESC']] });
    return sendOk(
      res,
      rows.map((v) => ({
        id: v.id,
        title: v.title,
        videoUrl: v.videoUrl,
        description: v.description || '',
      })),
    );
  } catch (e) {
    next(e);
  }
}

