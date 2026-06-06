import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { AdminUser, StaffProfile } from '../../models/index.js';
import { sendOk, sendFail } from '../../utils/apiResponse.js';
import { recordAdminAction } from '../../utils/auditLog.js';
import { ADMIN_ROLES, normalizeAdminRole } from '../../constants/rbac.js';

const STAFF_LIST_ROLES = ADMIN_ROLES;
const ONBOARD_ROLES = ['manager', 'hr', 'marketing', 'client_support', 'recruitment_exec'];

function generateTempPassword() {
  return `Nx${randomBytes(4).toString('hex')}!`;
}

function toStaffRow(admin, profile) {
  return {
    id: admin.id,
    name: admin.name || admin.email,
    email: admin.email,
    phone: admin.phone || null,
    role: admin.role,
    status: admin.isActive === false ? 'Inactive' : 'Active',
    isActive: admin.isActive !== false,
    lastLogin: admin.lastLoginAt || null,
    designation: profile?.designation || admin.role,
    baseSalary: profile ? Number(profile.baseSalary) : 0,
    upiId: profile?.upiId || null,
    mustResetPassword: Boolean(admin.mustResetPassword),
  };
}

export async function listStaff(_req, res, next) {
  try {
    const admins = await AdminUser.findAll({
      where: { role: STAFF_LIST_ROLES },
      order: [['createdAt', 'DESC']],
    });
    const profiles = await StaffProfile.findAll({
      where: { adminUserId: admins.map((a) => a.id) },
    });
    const profileMap = new Map(profiles.map((p) => [p.adminUserId, p]));
    return sendOk(
      res,
      admins.map((a) => toStaffRow(a, profileMap.get(a.id))),
      'ok',
    );
  } catch (e) {
    next(e);
  }
}

export async function createStaff(req, res, next) {
  try {
    if (normalizeAdminRole(req.adminRole) !== 'admin') {
      return sendFail(res, 'Only admin can onboard new staff', 403);
    }
    const { name, email, phone, role, designation, baseSalary, upiId } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const staffRole = String(role || 'manager').toLowerCase();
    if (!name?.trim() || !normalizedEmail) {
      return sendFail(res, 'Name and email are required', 400);
    }
    if (!ONBOARD_ROLES.includes(staffRole)) {
      return sendFail(res, `Invalid role. Allowed: ${ONBOARD_ROLES.join(', ')}`, 400);
    }
    const existing = await AdminUser.findOne({ where: { email: normalizedEmail } });
    if (existing) return sendFail(res, 'Email already registered', 409);

    const tempPassword = generateTempPassword();
    const admin = await AdminUser.create({
      id: `admin_${randomUUID().slice(0, 10)}`,
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(tempPassword, 10),
      name: String(name).trim(),
      phone: phone ? String(phone).replace(/\D/g, '').slice(-10) : null,
      role: staffRole,
      isActive: true,
      mustResetPassword: true,
    });

    await StaffProfile.create({
      id: `sp_${admin.id}`,
      adminUserId: admin.id,
      designation: designation || staffRole,
      baseSalary: baseSalary != null ? baseSalary : 0,
      upiId: upiId || null,
    });

    await recordAdminAction(req.adminId, 'staff_create', {
      entityType: 'admin_user',
      entityId: admin.id,
      meta: { name: admin.name, email: admin.email, role: staffRole },
      req,
    });

    return sendOk(
      res,
      {
        staff: toStaffRow(admin, await StaffProfile.findOne({ where: { adminUserId: admin.id } })),
        tempPassword,
        loginUrl: '/login',
      },
      'Staff onboarded. Share the temporary password securely.',
    );
  } catch (e) {
    next(e);
  }
}

export async function updateStaff(req, res, next) {
  try {
    const admin = await AdminUser.findByPk(req.params.id);
    if (!admin) return sendFail(res, 'Staff member not found', 404);
    if (normalizeAdminRole(admin.role) === 'admin' && normalizeAdminRole(req.adminRole) !== 'admin') {
      return sendFail(res, 'Cannot modify admin accounts', 403);
    }

    const { name, phone, role, isActive, designation, baseSalary, upiId } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined) updates.phone = phone ? String(phone).replace(/\D/g, '').slice(-10) : null;
    if (role !== undefined) {
      const staffRole = String(role).toLowerCase();
      if (!ONBOARD_ROLES.includes(staffRole) && staffRole !== 'admin' && staffRole !== 'super_admin') {
        return sendFail(res, `Invalid role. Allowed: ${ONBOARD_ROLES.join(', ')}`, 400);
      }
      if ((staffRole === 'admin' || staffRole === 'super_admin') && normalizeAdminRole(req.adminRole) !== 'admin') {
        return sendFail(res, 'Only admin can assign admin role', 403);
      }
      updates.role = staffRole;
    }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (Object.keys(updates).length) await admin.update(updates);

    const profile = await StaffProfile.findOne({ where: { adminUserId: admin.id } });
    if (profile && (designation !== undefined || baseSalary !== undefined || upiId !== undefined)) {
      await profile.update({
        designation: designation ?? profile.designation,
        baseSalary: baseSalary != null ? baseSalary : profile.baseSalary,
        upiId: upiId !== undefined ? upiId : profile.upiId,
      });
    }

    await recordAdminAction(req.adminId, 'staff_update', {
      entityType: 'admin_user',
      entityId: admin.id,
      meta: { name: admin.name, role: admin.role },
      req,
    });

    await admin.reload();
    const refreshedProfile = await StaffProfile.findOne({ where: { adminUserId: admin.id } });
    return sendOk(res, toStaffRow(admin, refreshedProfile), 'Staff updated');
  } catch (e) {
    next(e);
  }
}
