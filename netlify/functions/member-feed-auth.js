const crypto = require('crypto');

const DEFAULT_MEMBER_ALLOWED = [
  'https://simplestocks.com',
  'https://www.simplestocks.com',
  'https://simplestocks.squarespace.com'
];

const DEFAULT_ADMIN_ALLOWED = [
  'https://jazzy-starlight-0a9a95.netlify.app'
];

const AUDIENCE = 'member-feed';
const DEFAULT_TTL_SECONDS = 300;

function configuredOrigins(envName, defaults) {
  return String(process.env[envName] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .concat(defaults);
}

function allowedOrigins() {
  return configuredOrigins('MEMBER_FEED_ALLOWED_ORIGINS', DEFAULT_MEMBER_ALLOWED);
}

function adminOrigins() {
  return configuredOrigins('MEMBER_FEED_ADMIN_ORIGINS', DEFAULT_ADMIN_ALLOWED);
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch (error) {
    return '';
  }
}

function requestOrigin(event) {
  const origin = normalizeOrigin(event.headers.origin || event.headers.Origin || '');
  if (origin) return origin;
  return normalizeOrigin(event.headers.referer || event.headers.Referer || '');
}

function isAllowed(event, options = {}) {
  const origin = requestOrigin(event);
  if (!origin) return false;
  if (allowedOrigins().includes(origin)) return true;
  return Boolean(options.allowAdmin && adminOrigins().includes(origin));
}

function ticketSecret() {
  return process.env.MEMBER_FEED_SECRET || process.env.ADMIN_SESSION_SECRET || '';
}

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sign(value) {
  return base64url(crypto.createHmac('sha256', ticketSecret()).update(value).digest());
}

function makeTicket(ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!ticketSecret()) return '';
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    aud: AUDIENCE,
    iat: now,
    exp: now + ttlSeconds
  }));
  return `${payload}.${sign(payload)}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyTicket(token) {
  if (!ticketSecret()) return { ok: false, reason: 'ticket secret missing' };
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return { ok: false, reason: 'ticket missing' };
  if (!safeEqual(sign(payload), signature)) return { ok: false, reason: 'ticket signature invalid' };

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch (error) {
    return { ok: false, reason: 'ticket payload invalid' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (parsed.aud !== AUDIENCE) return { ok: false, reason: 'ticket audience invalid' };
  if (!Number.isFinite(parsed.exp) || parsed.exp < now) return { ok: false, reason: 'ticket expired' };
  if (!Number.isFinite(parsed.iat) || parsed.iat > now + 60) return { ok: false, reason: 'ticket issued in future' };
  return { ok: true, reason: 'valid' };
}

function corsHeaders(origin = '') {
  return origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Member-Token',
    'Vary': 'Origin'
  } : {};
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  allowedOrigins,
  adminOrigins,
  corsHeaders,
  isAllowed,
  makeTicket,
  requestOrigin,
  ticketSecret,
  verifyTicket
};
