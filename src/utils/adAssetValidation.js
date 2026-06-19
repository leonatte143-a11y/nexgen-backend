const IMAGE_MAX_BYTES = 500 * 1024;
const VIDEO_MAX_BYTES = 5 * 1024 * 1024;

export function validateAdAssetMeta({ mediaType, fileSizeBytes, durationSec, width, height }) {
  const errors = [];
  const mt = String(mediaType || 'image').toLowerCase();

  if (mt === 'image') {
    if (fileSizeBytes != null && fileSizeBytes > IMAGE_MAX_BYTES) {
      errors.push('Image must be 500 KB or smaller');
    }
    if (width && height) {
      const ratio = width / height;
      const ok169 = Math.abs(ratio - 16 / 9) < 0.1;
      const ok916 = Math.abs(ratio - 9 / 16) < 0.1;
      if (!ok169 && !ok916) errors.push('Image aspect ratio must be 16:9 or 9:16');
    }
  } else if (mt === 'video') {
    if (fileSizeBytes != null && fileSizeBytes > VIDEO_MAX_BYTES) {
      errors.push('Video must be 5 MB or smaller');
    }
    if (durationSec != null && durationSec > 15) {
      errors.push('Video must be 15 seconds or shorter');
    }
  }

  return errors;
}
