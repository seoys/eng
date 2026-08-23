import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '90d';

export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId, secret) {
  return jwt.sign({ sub: userId }, secret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token, secret) {
  const payload = jwt.verify(token, secret);
  return payload.sub;
}
