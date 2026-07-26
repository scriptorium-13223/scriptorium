const crypto = require('crypto');
const config = require('../config');
const { AppError } = require('./errorHandler');

// No user accounts, no session store, no JWT library needed for a single admin.
// The admin panel exchanges ADMIN_SECRET (entered once in the browser) for a
// signed, time-limited token. The token is just an HMAC of an expiry timestamp,
// so the server stays fully stateless (nothing to store, nothing to purge for this).

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hour admin session

function signToken(expiresAt) {
  const hmac = crypto.createHmac('sha256', config.adminSecret);
  hmac.update(String(expiresAt));
  return `${expiresAt}.${hmac.digest('hex')}`;
}

function issueTokenForValidSecret(providedSecret) {
  // Constant-time compare to avoid timing attacks on the shared secret
  const a = Buffer.from(providedSecret || '');
  const b = Buffer.from(config.adminSecret);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return null;

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return signToken(expiresAt);
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [expiresAtStr, signature] = token.split('.');
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!expiresAt || Date.now() > expiresAt) return false;

  const expectedSignature = signToken(expiresAt).split('.')[1];
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Middleware: protects all /api/admin/* routes except the login route itself
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!verifyToken(token)) {
    return next(new AppError('Unauthorized. Please log in again.', 401, 'ADMIN_UNAUTHORIZED'));
  }
  next();
}

module.exports = { issueTokenForValidSecret, requireAdmin };
