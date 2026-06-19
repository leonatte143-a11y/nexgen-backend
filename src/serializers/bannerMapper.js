export function toBannerDto(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    imageUrl: row.imageUrl ?? '',
    mediaType: row.mediaType || 'image',
    placement: row.placement || 'home_dashboard',
    mediaUrl: row.imageUrl ?? '',
    ctaText: row.ctaText ?? 'Book Now',
    redirectType: row.redirectType,
    redirectValue: row.redirectValue ?? '',
    city: row.city ?? null,
    isActive: !!row.isActive,
    priority: row.priority ?? 0,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    endDate: row.endDate ? row.endDate.toISOString() : null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
