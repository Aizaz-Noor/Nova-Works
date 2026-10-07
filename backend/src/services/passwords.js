import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export function hashPassword(password) {
 const salt = randomBytes(16).toString('hex');
 return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, hash) {
 const [scheme, salt, value] = hash.split(':');
 if (scheme !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(value || '')) return false;
 return timingSafeEqual(Buffer.from(value, 'hex'), scryptSync(password, salt, 64));
}
