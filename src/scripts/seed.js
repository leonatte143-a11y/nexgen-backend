import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import {
  User,
  Partner,
  Category,
  Service,
  PartnerServicePricing,
  Notification,
  AdminUser,
  Booking,
  AdvertisementBanner,
  SearchLog,
  PartnerDocument,
  SupportTicket,
  Coupon,
  AppSetting,
  GeoZone,
} from '../models/index.js';
import { syncDatabase, sequelize } from '../models/index.js';
import { computeBill, DEFAULT_VISITING_FEE } from '../services/money.js';

const BUCKETS = [
  { id: 'home_services', nameEn: 'Home Services', nameTe: 'ఇంటి సేవలు', emoji: '🏠' },
  { id: 'home_repair', nameEn: 'Home Repair', nameTe: 'ఇంటి మరమ్మతు', emoji: '🔧' },
  { id: 'tech_supply', nameEn: 'Tech & Supply', nameTe: 'టెక్ & సరఫరా', emoji: '💻' },
  { id: 'life_health', nameEn: 'Life & Health', nameTe: 'ఆరోగ్యం', emoji: '🩺' },
  { id: 'professional_education', nameEn: 'Professional & Education', nameTe: 'వృత్తి & విద్య', emoji: '🎓' },
  { id: 'events', nameEn: 'Events', nameTe: 'కార్యక్రమాలు', emoji: '🎉' },
];

async function ensureLegacyColumns() {
  const alters = [
    'ALTER TABLE admin_users ADD COLUMN name VARCHAR(128) NULL',
    'ALTER TABLE admin_users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT \'super_admin\'',
    'ALTER TABLE services ADD COLUMN commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00',
    'ALTER TABLE bookings ADD COLUMN created_at DATETIME NULL',
    'ALTER TABLE bookings ADD COLUMN updated_at DATETIME NULL',
  ];
  for (const sql of alters) {
    try {
      await sequelize.query(sql);
    } catch {
      /* column may already exist */
    }
  }
}

async function run() {
  // alter:false avoids MySQL "too many keys" on legacy tables; new models still sync via create
  await syncDatabase({ alter: false });
  await ensureLegacyColumns();

  const adminEmail = (process.env.ADMIN_SEED_EMAIL || 'admin@nexgen.local').toLowerCase();
  const adminPass = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!';
  let admin = await AdminUser.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await AdminUser.create({
      id: 'admin_1',
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPass, 10),
      name: 'NEXGEN Admin',
      role: 'super_admin',
    });
  }

  for (const b of BUCKETS) {
    await Category.findOrCreate({ where: { id: b.id }, defaults: b });
  }

  const partnerId = 'partner_phani';
  const [phani] = await Partner.findOrCreate({
    where: { id: partnerId },
    defaults: {
      id: partnerId,
      phone: '9876543210',
      name: 'Phani Kumar',
      photoUrl: '',
      rating: 4.8,
      jobsCompleted: 245,
      isOnline: true,
      skills: ['Fan Repair', 'Switchboard Fix', 'AC Repair'],
      categories: ['Electrician', 'Home Repair'],
      walletBalance: 850,
      todayEarnings: 1250,
      lifetimeEarnings: 67250,
      bankName: 'SBI',
      bankAccount: 'XXXXXX1234',
      verificationStatus: 'Verified',
      trainingProgress: 80,
      badges: ['Top Rated', '500+ Jobs', 'Safety Certified'],
      strikeCount: 0,
      primaryCity: 'Rajahmundry',
      serviceInnerRadiusKm: 5,
      serviceOuterRadiusKm: 10,
      allowOutOfStation: false,
      totalJobsCount: 245,
      completedJobsCount: 240,
      rewardPoints: 3200,
    },
  });

  const services = [
    {
      id: 'svc_fan_repair',
      categoryId: 'home_repair',
      name: 'Fan Repair',
      subtext: 'Fan Repair',
      categoryLabel: 'Electrical',
      basePrice: 250,
      rating: 4.6,
      reviewsCount: 187,
      distanceKm: 1.2,
      description: 'Complete fan repairing and maintenance.',
    },
    {
      id: 'svc_plumber',
      categoryId: 'home_repair',
      name: 'Plumber',
      subtext: 'Leakage/Taps',
      categoryLabel: 'Plumbing',
      basePrice: 300,
      rating: 4.7,
      reviewsCount: 210,
      distanceKm: 2.1,
      description: 'Tap leaks, pipe fixes, and bathroom fittings.',
    },
  ];

  for (const s of services) {
    const [row] = await Service.findOrCreate({
      where: { id: s.id },
      defaults: { ...s, partnerId: phani.id },
    });
    if (row.partnerId !== phani.id) await row.update({ partnerId: phani.id });
  }

  const [user] = await User.findOrCreate({
    where: { phone: '9876543210' },
    defaults: {
      id: 'user_9876543210',
      phone: '9876543210',
      firstName: 'Dwaraka',
      lastName: 'Sai',
      email: 'dwaraka.sai@email.com',
      address: 'Danavaipeta, Rajahmundry, AP',
      rewardPoints: 850,
      referralCode: 'NEXGEN2026',
    },
  });

  for (const pr of [
    { id: 'pp1', serviceName: 'Fan Repair', category: 'Electrical', baseCost: 250 },
    { id: 'pp2', serviceName: 'Light Fitting', category: 'Electrical', baseCost: 200 },
    { id: 'pp3', serviceName: 'Switch Board Repair', category: 'Electrical', baseCost: 300 },
  ]) {
    await PartnerServicePricing.findOrCreate({
      where: { id: pr.id },
      defaults: { ...pr, partnerId: phani.id },
    });
  }

  for (const n of [
    {
      id: 'n1',
      type: 'order',
      title: 'Booking',
      body: 'Your service request is confirmed (seed).',
      read: false,
      timeLabel: '2m ago',
    },
  ]) {
    await Notification.findOrCreate({
      where: { id: n.id },
      defaults: { ...n, userId: user.id },
    });
  }

  const base = 250;
  const bill = computeBill(base, DEFAULT_VISITING_FEE);
  const subtotal = base + bill.visitingFee;
  const partnerShare = Math.round((subtotal - bill.adminComm) * 100) / 100;
  await Booking.findOrCreate({
    where: { id: 'bk_active_1' },
    defaults: {
      id: 'bk_active_1',
      userId: user.id,
      serviceId: 'svc_fan_repair',
      partnerId: phani.id,
      userStatus: 'en_route',
      partnerStatus: 'in_progress',
      serviceName: 'Fan Repair',
      categoryLabel: 'Electrical',
      partnerName: phani.name,
      partnerRating: phani.rating,
      customerName: 'Dwaraka Sai',
      address: 'Danavaipeta, Rajahmundry',
      notes: 'Seed data',
      totalAmount: bill.total,
      visitingFee: bill.visitingFee,
      adminCommission: bill.adminComm,
      partnerShare,
      startOtp: '5821',
      scheduledAt: new Date().toISOString(),
      scheduledAtIso: new Date(),
      etaMins: 8,
      distanceKm: 1.2,
      requestedAtLabel: '1h ago',
    },
  });

  const bannerSeeds = [
    {
      id: 'banner_hw_sale',
      title: 'Rajahmundry Hardware Sale',
      subtitle: '20% off on electrical items',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=320&fit=crop',
      ctaText: 'Book Now',
      redirectType: 'category',
      redirectValue: 'home_repair',
      city: 'Rajahmundry',
      isActive: true,
      priority: 100,
    },
    {
      id: 'banner_home_clean',
      title: 'Deep Home Cleaning',
      subtitle: 'Verified professionals at your doorstep',
      imageUrl: 'https://images.unsplash.com/photo-1581578731544-c64695cc6952?w=800&h=320&fit=crop',
      ctaText: 'Explore',
      redirectType: 'category',
      redirectValue: 'home_services',
      city: null,
      isActive: true,
      priority: 90,
    },
    {
      id: 'banner_events',
      title: 'Wedding Season Offers',
      subtitle: 'Photographers, catering & more',
      imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&h=320&fit=crop',
      ctaText: 'View Events',
      redirectType: 'event',
      redirectValue: 'events',
      city: 'Guntur',
      isActive: true,
      priority: 80,
    },
    {
      id: 'banner_rewards',
      title: 'Earn NEXGEN Rewards',
      subtitle: 'Points on every booking',
      imageUrl: '',
      ctaText: 'Learn More',
      redirectType: 'offer',
      redirectValue: '',
      city: null,
      isActive: true,
      priority: 70,
    },
  ];

  for (const b of bannerSeeds) {
    await AdvertisementBanner.findOrCreate({
      where: { id: b.id },
      defaults: { ...b, createdBy: admin?.id || 'admin_1' },
    });
  }

  const [pendingPartner] = await Partner.findOrCreate({
    where: { id: 'partner_pending_1' },
    defaults: {
      id: 'partner_pending_1',
      phone: '9123456789',
      name: 'Ravi Teja',
      verificationStatus: 'Pending',
      skills: ['Home Nursing'],
      categories: ['Health'],
      primaryCity: 'Rajahmundry',
    },
  });
  for (const doc of [
    { id: 'doc_aadhaar_1', docType: 'aadhaar', fileUrl: 'https://placehold.co/400x250?text=Aadhaar' },
    { id: 'doc_selfie_1', docType: 'selfie', fileUrl: 'https://placehold.co/200x200?text=Selfie' },
    { id: 'doc_license_1', docType: 'license', fileUrl: 'https://placehold.co/400x250?text=License' },
  ]) {
    await PartnerDocument.findOrCreate({
      where: { id: doc.id },
      defaults: { ...doc, partnerId: pendingPartner.id, status: 'pending' },
    });
  }

  for (const sl of [
    { id: 'sl_1', query: 'home nursing', resultsCount: 0 },
    { id: 'sl_2', query: 'tiffin delivery', resultsCount: 2 },
    { id: 'sl_3', query: 'fan repair', resultsCount: 5 },
  ]) {
    await SearchLog.findOrCreate({
      where: { id: sl.id },
      defaults: { ...sl, city: 'Rajahmundry' },
    });
  }

  await SupportTicket.findOrCreate({
    where: { id: 'tk_seed_1' },
    defaults: {
      id: 'tk_seed_1',
      bookingId: 'bk_active_1',
      userId: user.id,
      partnerId: phani.id,
      subject: 'Price dispute — Fan Repair',
      description: 'User reports partner quoted higher than app price.',
      status: 'open',
      chatTranscript: [
        { from: 'user', text: 'The price shown was ₹250', at: new Date().toISOString() },
        { from: 'partner', text: 'Material cost is extra', at: new Date().toISOString() },
      ],
    },
  });

  await Coupon.findOrCreate({
    where: { id: 'cp_godavari50' },
    defaults: {
      id: 'cp_godavari50',
      code: 'GODAVARI50',
      discountType: 'flat',
      discountValue: 50,
      city: 'Rajahmundry',
      active: true,
    },
  });

  await AppSetting.findOrCreate({
    where: { settingKey: 'global' },
    defaults: {
      id: 'settings_global',
      settingKey: 'global',
      settingValue: {
        commission_percent: 10,
        gst_percent: 18,
        surge_fee_default: 0,
        otp_digits: 6,
        visiting_fee: 30,
        payout_threshold: 500,
      },
    },
  });

  await GeoZone.findOrCreate({
    where: { id: 'gz_rajahmundry' },
    defaults: {
      id: 'gz_rajahmundry',
      name: 'Rajahmundry Core',
      city: 'Rajahmundry',
      surgeFee: 0,
      active: true,
    },
  });

  console.log('Seed complete. Admin:', adminEmail, '/', adminPass);
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
