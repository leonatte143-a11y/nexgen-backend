import jwt from 'jsonwebtoken';

const { JWT_USER_SECRET, JWT_PARTNER_SECRET, JWT_ADMIN_SECRET, JWT_EXPIRES_IN = '7d' } = process.env;

const secrets = {
  user: () => JWT_USER_SECRET,
  partner: () => JWT_PARTNER_SECRET,
  admin: () => JWT_ADMIN_SECRET,
};

export function signToken(payload, role) {
  const key = secrets[role]?.();
  console.log('key---', key);
  if (!key) throw new Error(`Missing JWT secret for role: ${role}`);
  return jwt.sign({ ...payload, role }, key, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token, role) {
  const key = secrets[role]?.();
  if (!key) throw new Error(`Missing JWT secret for role: ${role}`);
  return jwt.verify(token, key);
}
