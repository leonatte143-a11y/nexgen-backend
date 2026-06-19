import { toNum, timeAgoLabel } from './formatters.js';

export function toMockUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: user.address,
    rewardPoints: user.rewardPoints,
    referralCode: user.referralCode,
  };
}

export function toCatalogService(service) {
  const p = service.partner;
  if (!p) {
    return {
      id: service.id,
      bucketId: service.categoryId,
      name: service.name,
      subtext: service.subtext,
      categoryLabel: service.categoryLabel,
      basePrice: toNum(service.basePrice),
      premiumPrice: service.premiumPrice != null ? toNum(service.premiumPrice) : toNum(service.basePrice),
      rating: toNum(service.rating),
      reviewsCount: service.reviewsCount,
      partner: {
        id: service.partnerId,
        name: 'Partner',
        rating: 4.5,
        jobsCompleted: 0,
        photoUrl: undefined,
      },
      distanceKm: toNum(service.distanceKm),
      description: service.description,
    };
  }
  return {
    id: service.id,
    bucketId: service.categoryId,
    name: service.name,
    subtext: service.subtext,
    categoryLabel: service.categoryLabel,
    basePrice: toNum(service.basePrice),
    premiumPrice: service.premiumPrice != null ? toNum(service.premiumPrice) : toNum(service.basePrice),
    rating: toNum(service.rating),
    reviewsCount: service.reviewsCount,
    partner: {
      id: p.id,
      name: p.name,
      rating: toNum(p.rating),
      jobsCompleted: p.jobsCompleted,
      photoUrl: p.photoUrl || undefined,
    },
    distanceKm: toNum(service.distanceKm),
    description: service.description,
  };
}

export function toUserBooking(b, lineItems = []) {
  const showEndOtp =
    b.workDoneRequested && b.partnerStatus === 'in_progress' && b.endOtp;
  return {
    id: b.id,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    categoryLabel: b.categoryLabel,
    partnerName: b.partnerName,
    partnerRating: toNum(b.partnerRating),
    status: b.userStatus,
    totalAmount: toNum(b.totalAmount),
    endOtp: showEndOtp ? b.endOtp : undefined,
    scheduledAt: b.scheduledAt,
    createdAt: b.createdAt,
    address: b.address,
    etaMins: b.etaMins ?? undefined,
    visitingFee: b.visitingFee != null ? toNum(b.visitingFee) : undefined,
    itemsSubtotal: b.itemsSubtotal != null ? toNum(b.itemsSubtotal) : undefined,
    promoDiscount: b.promoDiscount != null ? toNum(b.promoDiscount) : undefined,
    distanceKm: b.distanceKm != null ? toNum(b.distanceKm) : undefined,
    lineItems: lineItems.length ? lineItems : undefined,
    isPartnerArrived: b.isPartnerArrived || false,
    workDoneRequested: Boolean(b.workDoneRequested),
    heavyWorkEstimateRequested: Boolean(b.heavyWorkEstimate),
    customRequirements: b.customRequirements || undefined,
    paymentStatus: b.paymentStatus || 'pending',
    paymentMethod: b.paymentMethod || undefined,
  };
}

export function toPartnerRequest(b, lineItems = []) {
  const h = b.heavyWorkEstimate;
  return {
    id: b.id,
    serviceName: b.serviceName,
    category: b.categoryLabel,
    customerName: b.customerName,
    address: b.address,
    distanceKm: toNum(b.distanceKm),
    scheduledAt: b.scheduledAt,
    status: b.partnerStatus,
    amount: toNum(b.totalAmount),
    commission: toNum(b.adminCommission),
    partnerShare: toNum(b.partnerShare),
    notes: b.notes || '',
    customRequirements: b.customRequirements || undefined,
    customerPhone: b.customerPhone || undefined,
    isPartnerArrived: b.isPartnerArrived || false,
    workDoneRequested: Boolean(b.workDoneRequested),
    requestedAt: b.requestedAtLabel || timeAgoLabel(b.createdAt),
    extraServices: b.extraServices || undefined,
    lineItems: lineItems.length ? lineItems : undefined,
    itemsSubtotal: b.itemsSubtotal != null ? toNum(b.itemsSubtotal) : undefined,
    visitingFee: b.visitingFee != null ? toNum(b.visitingFee) : undefined,
    pendingEstimateAmount: b.pendingEstimateAmount != null ? toNum(b.pendingEstimateAmount) : undefined,
    heavyWorkEstimate: h || undefined,
    visitingFeePartner: b.visitingFeePartner != null ? toNum(b.visitingFeePartner) : undefined,
    isPartnerArrived: b.isPartnerArrived || false,
  };
}

function jsonStringArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val ? [val] : [];
    }
  }
  return [];
}

export function toPartnerProfile(p) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    photoUrl: p.photoUrl || '',
    rating: toNum(p.rating),
    jobsCompleted: p.jobsCompleted,
    isOnline: p.isOnline,
    isFrozen: Boolean(p.isFrozen),
    skills: jsonStringArray(p.skills),
    categories: jsonStringArray(p.categories),
    walletBalance: toNum(p.walletBalance),
    todayEarnings: toNum(p.todayEarnings),
    lifetimeEarnings: toNum(p.lifetimeEarnings),
    bankName: p.bankName || '',
    bankAccount: p.bankAccount || '',
    verificationStatus: p.verificationStatus,
    trainingProgress: p.trainingProgress,
    badges: p.badges || [],
    strikeCount: p.strikeCount,
    primaryCity: p.primaryCity,
    serviceInnerRadiusKm: p.serviceInnerRadiusKm,
    serviceOuterRadiusKm: p.serviceOuterRadiusKm,
    allowOutOfStation: p.allowOutOfStation,
  };
}

export function toEarningsSummary(partner) {
  return {
    todayEarnings: toNum(partner.todayEarnings),
    lifetimeEarnings: toNum(partner.lifetimeEarnings),
    availableBalance: toNum(partner.walletBalance),
    totalJobs: partner.totalJobsCount ?? 0,
    completedJobs: partner.completedJobsCount ?? 0,
    commissionRate: 10,
    pendingPayout: 0,
    rewardPoints: partner.rewardPoints ?? 0,
  };
}

export function toServiceBucket(cat) {
  return {
    id: cat.id,
    nameEn: cat.nameEn,
    nameTe: cat.nameTe,
    emoji: cat.emoji,
    iconUrl: cat.iconUrl || null,
    minPrice: cat.minPrice != null ? Number(cat.minPrice) : null,
    maxPrice: cat.maxPrice != null ? Number(cat.maxPrice) : null,
    isActive: cat.isActive !== false,
  };
}

export function toAppNotification(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    timeLabel: n.timeLabel || 'Recently',
    read: n.read,
  };
}
