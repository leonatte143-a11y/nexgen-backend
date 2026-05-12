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

export function toUserBooking(b) {
  return {
    id: b.id,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    categoryLabel: b.categoryLabel,
    partnerName: b.partnerName,
    partnerRating: toNum(b.partnerRating),
    status: b.userStatus,
    totalAmount: toNum(b.totalAmount),
    startOtp: b.startOtp,
    scheduledAt: b.scheduledAt,
    createdAt: b.createdAt,
    address: b.address,
    etaMins: b.etaMins ?? undefined,
    visitingFee: b.visitingFee != null ? toNum(b.visitingFee) : undefined,
    isPartnerArrived: b.isPartnerArrived || false,
    heavyWorkEstimateRequested: Boolean(b.heavyWorkEstimate),
  };
}

export function toPartnerRequest(b) {
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
    startOtp: b.startOtp,
    notes: b.notes || '',
    requestedAt: b.requestedAtLabel || timeAgoLabel(b.createdAt),
    extraServices: b.extraServices || undefined,
    pendingEstimateAmount: b.pendingEstimateAmount != null ? toNum(b.pendingEstimateAmount) : undefined,
    heavyWorkEstimate: h || undefined,
    visitingFee: b.visitingFeePartner != null ? toNum(b.visitingFeePartner) : undefined,
    isPartnerArrived: b.isPartnerArrived || false,
  };
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
    skills: p.skills || [],
    categories: p.categories || [],
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
