/** Admin staff roles (business roles — JWT audience remains `admin`). */
export const ADMIN_ROLES = [
  'admin',
  'super_admin',
  'manager',
  'hr',
  'marketing',
  'client_support',
  'recruitment_exec',
];

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',
  REVENUE_VIEW: 'revenue:view',
  PAYOUTS_MANAGE: 'payouts:manage',
  PRICING_MANAGE: 'pricing:manage',
  SERVICES_MANAGE: 'services:manage',
  KYC_MANAGE: 'kyc:manage',
  PARTNERS_MANAGE: 'partners:manage',
  PARTNERS_COMPLIANCE: 'partners:compliance',
  BOOKINGS_MANAGE: 'bookings:manage',
  BOOKINGS_REASSIGN: 'bookings:reassign',
  LIVE_MONITOR: 'live:view',
  DEMAND_ANALYTICS: 'demand:view',
  ESTABLISH_LOCATION: 'zones:establish',
  ANALYTICS_VIEW: 'analytics:view',
  AUDIT_VIEW: 'audit:view',
  SUPPORT_MANAGE: 'support:manage',
  USERS_MANAGE: 'users:manage',
  MARKETING_MANAGE: 'marketing:manage',
  NOTIFICATIONS_BROADCAST: 'notifications:broadcast',
  SETTINGS_MANAGE: 'settings:manage',
  STAFF_MANAGE: 'staff:manage',
  PAYROLL_VIEW: 'payroll:view',
  CHAT_MONITOR: 'chat:monitor',
  FRAUD_VIEW: 'fraud:view',
  SHOPS_MANAGE: 'shops:manage',
  SHOPS_VERIFY: 'shops:verify',
};

/** Maps legacy super_admin → admin privileges. */
export function normalizeAdminRole(role) {
  const r = String(role || 'admin').toLowerCase();
  if (r === 'super_admin') return 'admin';
  if (ADMIN_ROLES.includes(r)) return r;
  return 'admin';
}

const ALL = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS = {
  admin: ALL,
  manager: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.BOOKINGS_REASSIGN,
    PERMISSIONS.LIVE_MONITOR,
    PERMISSIONS.DEMAND_ANALYTICS,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.PARTNERS_MANAGE,
    PERMISSIONS.CHAT_MONITOR,
    PERMISSIONS.PRICING_MANAGE,
    PERMISSIONS.SERVICES_MANAGE,
    PERMISSIONS.SHOPS_VERIFY,
  ],
  hr: [
    PERMISSIONS.STAFF_MANAGE,
    PERMISSIONS.PAYROLL_VIEW,
  ],
  marketing: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.DEMAND_ANALYTICS,
    PERMISSIONS.MARKETING_MANAGE,
    PERMISSIONS.NOTIFICATIONS_BROADCAST,
  ],
  client_support: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.LIVE_MONITOR,
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.CHAT_MONITOR,
    PERMISSIONS.SUPPORT_MANAGE,
  ],
  recruitment_exec: [
    PERMISSIONS.KYC_MANAGE,
    PERMISSIONS.PARTNERS_MANAGE,
    PERMISSIONS.PARTNERS_COMPLIANCE,
  ],
};

export function roleHasPermission(adminRole, permission) {
  const role = normalizeAdminRole(adminRole);
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin;
  return perms.includes(permission);
}

export function roleHasAnyPermission(adminRole, permissions) {
  return permissions.some((p) => roleHasPermission(adminRole, p));
}
