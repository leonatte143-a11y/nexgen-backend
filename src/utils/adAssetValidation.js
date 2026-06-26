const IMAGE_MAX_BYTES = 500 * 1024;
const VIDEO_MAX_BYTES = 5 * 1024 * 1024;
const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 608;
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const DIM_TOLERANCE = 24;

export function validateAdAssetMeta({ mediaType, fileSizeBytes, durationSec, width, height }) {
  const errors = [];
  const mt = String(mediaType || 'image').toLowerCase();

  if (mt === 'image') {
    if (fileSizeBytes != null && fileSizeBytes > IMAGE_MAX_BYTES) {
      errors.push('Poster must be 500 KB or smaller');
    }
    if (width && height) {
      const wOk = Math.abs(width - POSTER_WIDTH) <= DIM_TOLERANCE;
      const hOk = Math.abs(height - POSTER_HEIGHT) <= DIM_TOLERANCE;
      if (!wOk || !hOk) {
        errors.push(`Poster dimensions must be ${POSTER_WIDTH}px × ${POSTER_HEIGHT}px`);
      }
    }
  } else if (mt === 'video') {
    if (fileSizeBytes != null && fileSizeBytes > VIDEO_MAX_BYTES) {
      errors.push('Video must be 5 MB or smaller');
    }
    if (durationSec != null && durationSec > 15) {
      errors.push('Video must be 15 seconds or shorter');
    }
    if (width && height) {
      const wOk = Math.abs(width - VIDEO_WIDTH) <= DIM_TOLERANCE;
      const hOk = Math.abs(height - VIDEO_HEIGHT) <= DIM_TOLERANCE;
      if (!wOk || !hOk) {
        errors.push(`Video dimensions must be ${VIDEO_WIDTH}px × ${VIDEO_HEIGHT}px`);
      }
    }
  }

  return errors;
}
