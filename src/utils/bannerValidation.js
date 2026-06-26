export const BANNER_REDIRECT_TYPES = [
  'category',
  'service',
  'partner',
  'external',
  'offer',
  'event',
  'all_services',
  'none',
];

const URL_RE = /^https?:\/\/.+/i;

export function isValidImageUrl(url) {
  if (url == null || url === '') return true;
  const s = String(url).trim();
  return URL_RE.test(s);
}

export function isValidMediaUrl(url) {
  if (url == null || url === '') return false;
  const s = String(url).trim();
  return URL_RE.test(s) || s.startsWith('data:image/') || s.startsWith('data:video/');
}

export function validateBannerPayload(body, { partial = false } = {}) {
  const errors = [];
  const b = body || {};

  if (!partial || b.title !== undefined) {
    const title = String(b.title ?? '').trim();
    if (!title) errors.push('title is required');
    else if (title.length > 200) errors.push('title max 200 characters');
  }

  if (b.subtitle !== undefined && b.subtitle != null && String(b.subtitle).length > 300) {
    errors.push('subtitle max 300 characters');
  }

  if (b.imageUrl !== undefined && b.imageUrl != null && String(b.imageUrl).trim() && !isValidImageUrl(b.imageUrl) && !isValidMediaUrl(b.imageUrl)) {
    errors.push('imageUrl must be a valid http(s) URL or image data URL');
  }

  if (b.mediaType !== undefined) {
    const mt = String(b.mediaType || 'image').toLowerCase();
    if (!['image', 'video'].includes(mt)) errors.push('mediaType must be image or video');
  }

  if (!partial || b.redirectType !== undefined) {
    const rt = String(b.redirectType ?? 'none').trim();
    if (!BANNER_REDIRECT_TYPES.includes(rt)) {
      errors.push(`redirectType must be one of: ${BANNER_REDIRECT_TYPES.join(', ')}`);
    }
    if (rt === 'external') {
      const v = String(b.redirectValue ?? '').trim();
      if (!URL_RE.test(v)) errors.push('redirectValue must be a valid URL for external redirects');
    }
    if (['category', 'service', 'partner', 'event'].includes(rt)) {
      const v = String(b.redirectValue ?? '').trim();
      if (!v) errors.push('redirectValue is required for this redirect type');
    }
  }

  if (b.priority !== undefined) {
    const p = Number(b.priority);
    if (!Number.isFinite(p) || p < 0 || p > 9999) errors.push('priority must be 0–9999');
  }

  if (b.isActive !== undefined && typeof b.isActive !== 'boolean' && b.isActive !== 0 && b.isActive !== 1) {
    errors.push('isActive must be boolean');
  }

  if (b.startDate !== undefined && b.startDate != null && Number.isNaN(Date.parse(b.startDate))) {
    errors.push('startDate must be a valid date');
  }
  if (b.endDate !== undefined && b.endDate != null && Number.isNaN(Date.parse(b.endDate))) {
    errors.push('endDate must be a valid date');
  }
  if (b.startDate && b.endDate && new Date(b.startDate) > new Date(b.endDate)) {
    errors.push('startDate must be before endDate');
  }

  return errors;
}

export function parseCityQuery(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : s;
}
