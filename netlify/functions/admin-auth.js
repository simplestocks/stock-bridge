const crypto = require('crypto');

const COOKIE = 'ss_admin';
const MAX_AGE_SECONDS = 60 * 60 * 12;

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || '';
}

function timingEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

function makeCookie() {
  const payload = b64url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }));
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function parseCookie(header) {
  return Object.fromEntries(String(header || '').split(';').map((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return ['', ''];
    return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
  }).filter(([key]) => key));
}

function isAuthed(event) {
  if (!getSecret()) return false;
  const token = parseCookie(event.headers.cookie || event.headers.Cookie)[COOKIE];
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !timingEqual(sig, sign(payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(data.exp || 0) > Math.floor(Date.now() / 1000);
  } catch (error) {
    return false;
  }
}

function checkPassword(password) {
  const configured = process.env.ADMIN_PASSWORD || '';
  if (!configured || !getSecret()) return false;
  return timingEqual(password, configured);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

module.exports = {
  checkPassword,
  clearCookie,
  isAuthed,
  json,
  makeCookie
};
