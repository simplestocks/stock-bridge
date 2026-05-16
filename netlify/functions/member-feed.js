const { readPosts } = require('./member-post-store');

const DEFAULT_ALLOWED = [
  'https://jazzy-starlight-0a9a95.netlify.app',
  'https://simplestocks.com',
  'https://www.simplestocks.com',
  'https://simplestocks.squarespace.com'
];

function allowedOrigins() {
  return String(process.env.MEMBER_FEED_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .concat(DEFAULT_ALLOWED);
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

function isAllowed(event) {
  const origin = requestOrigin(event);
  return Boolean(origin && allowedOrigins().includes(origin));
}

function response(statusCode, body, origin = '') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(origin ? {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin'
      } : {})
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event) {
  const origin = requestOrigin(event);

  if (event.httpMethod === 'OPTIONS') {
    if (!isAllowed(event)) return response(403, { error: 'Forbidden' });
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store',
        'Vary': 'Origin'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') return response(405, { error: 'Method Not Allowed' }, origin);
  if (!isAllowed(event)) return response(403, { error: 'Forbidden' });

  try {
    const posts = await readPosts(event);
    return response(200, posts, origin);
  } catch (error) {
    return response(500, { error: 'Feed unavailable' }, origin);
  }
};
