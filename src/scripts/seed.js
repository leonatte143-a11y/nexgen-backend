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

async function run() {
  await syncDatabase({ alter: true });

  const adminEmail = (process.env.ADMIN_SEED_EMAIL || 'admin@nexgen.local').toLowerCase();
  const adminPass = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!';
  let admin = await AdminUser.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await AdminUser.create({
      id: 'admin_1',
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPass, 10),
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

  console.log('Seed complete. Admin:', adminEmail, '/', adminPass);
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
