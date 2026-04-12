// netlify/functions/send-to-squarespace.js
// Accepts a morning-note payload from alerts.html, creates a Squarespace
// DRAFT via the internal API, then queues the result to GitHub.
//
// Env vars:
//   GITHUB_TOKEN            – contents:write on simplestocks/stock-bridge
//   SQUARESPACE_SITE_URL    – e.g. https://simplestocks.squarespace.com
//   SQUARESPACE_EMAIL       – Squarespace account email
//   SQUARESPACE_PASSWORD    – Squarespace account password

const https = require('https');
const { URL } = require('url');

const OWNER = 'simplestocks';
const REPO  = 'stock-bridge';

// Squarespace collection IDs
const COLLECTIONS = {
  'morning-note': '635dd55df0e2db5da59ef527',
  'trade-alert':  '63e597a94c7f135688639956'
};
const DEFAULT_COLLECTION = COLLECTIONS['morning-note'];

// ---- Generic HTTPS request helper ----
function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: opts.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...opts.headers
      }
    };
    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ---- GitHub API helper ----
function ghRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'stock-bridge-queue',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---- Cookie helpers ----
function extractCookiePairs(setCookies) {
  const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
  return arr.map(sc => sc.split(';')[0]);
}

function mergeCookies(existingPairs, newSetCookies) {
  const map = {};
  for (const pair of existingPairs) {
    const [k] = pair.split('=');
    map[k] = pair;
  }
  const newPairs = extractCookiePairs(newSetCookies);
  for (const pair of newPairs) {
    const [k] = pair.split('=');
    map[k] = pair;
  }
  return Object.values(map);
}

// ---- Squarespace auth ----
async function squarespaceLogin(siteUrl, email, password) {
  // Step 0: GET site root for crumb cookie
  const initRes = await request(`${siteUrl}/`, { method: 'GET' });
  if (initRes.status >= 400) {
    throw new Error(`GET / failed: ${initRes.status}`);
  }

  let cookiePairs = [];
  if (initRes.headers['set-cookie']) {
    cookiePairs = extractCookiePairs(initRes.headers['set-cookie']);
  }

  const initCookieStr = cookiePairs.join('; ');
  const initCrumbMatch = initCookieStr.match(/crumb=([^;]+)/);
  const initCrumb = initCrumbMatch ? initCrumbMatch[1] : '';

  // Step 1: POST /api/auth/Login
  const formBody = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const loginRes = await request(`${siteUrl}/api/auth/Login?crumb=${initCrumb}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formBody).toString(),
      'Cookie': initCookieStr,
      'Origin': siteUrl,
      'Referer': siteUrl
    },
    body: formBody
  });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.body.substring(0, 200)}`);
  }

  if (loginRes.headers['set-cookie']) {
    cookiePairs = mergeCookies(cookiePairs, loginRes.headers['set-cookie']);
  }

  const loginJson = JSON.parse(loginRes.body);
  const tokenLoginUrl = loginJson.targetWebsite && loginJson.targetWebsite.loginUrl;

  if (!tokenLoginUrl) {
    const finalCookieStr = cookiePairs.join('; ');
    const finalCrumbMatch = finalCookieStr.match(/crumb=([^;]+)/);
    if (finalCrumbMatch) {
      return { crumb: finalCrumbMatch[1], cookieHeader: finalCookieStr };
    }
    throw new Error('No targetWebsite.loginUrl and no crumb found');
  }

  // Step 2: Token exchange
  const sep = tokenLoginUrl.includes('?') ? '&' : '?';
  const tokenUrl = `${tokenLoginUrl}${sep}email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const tokenRes = await request(tokenUrl, {
    method: 'GET',
    headers: { 'Cookie': cookiePairs.join('; ') }
  });

  if (tokenRes.status < 200 || tokenRes.status >= 400) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  if (tokenRes.headers['set-cookie']) {
    cookiePairs = mergeCookies(cookiePairs, tokenRes.headers['set-cookie']);
  }

  const finalCookieStr = cookiePairs.join('; ');
  const crumbMatch = finalCookieStr.match(/crumb=([^;]+)/);
  if (!crumbMatch) {
    throw new Error('No crumb after login');
  }

  return { crumb: crumbMatch[1], cookieHeader: finalCookieStr };
}

// ---- Squarespace create draft ----
async function createDraft(siteUrl, auth, title, html, collectionId) {
  const payload = JSON.stringify({
    title: title,
    collectionId: collectionId || DEFAULT_COLLECTION,
    workflowState: 4,
    body: {
      raw: false,
      layout: {
        rows: [{
          columns: [{
            span: 12,
            blocks: [{
              type: 47,
              value: { html: html }
            }]
          }]
        }]
      }
    }
  });

  const res = await request(`${siteUrl}/api/content-items?crumb=${auth.crumb}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload).toString(),
      'Cookie': auth.cookieHeader
    },
    body: payload
  });

  if (res.status !== 200) {
    throw new Error(`Create draft failed: ${res.status} ${res.body.substring(0, 200)}`);
  }

  const result = JSON.parse(res.body);
  return { id: result.id, title: result.title, fullUrl: result.fullUrl, urlId: result.urlId };
}

// ---- Main handler ----
exports.handler = async function(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (!process.env.GITHUB_TOKEN) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ status: 'error', message: 'GITHUB_TOKEN not set' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { docId, title, html, plaintext } = payload;

    if (!html || !title) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ status: 'error', message: 'title and html are required' }) };
    }

    // Determine collection
    let collectionId = DEFAULT_COLLECTION;
    if (docId && docId.includes('trade-alert')) {
      collectionId = COLLECTIONS['trade-alert'];
    }

    // ---- Squarespace draft creation ----
    let draftInfo = null;
    const siteUrl  = (process.env.SQUARESPACE_SITE_URL || '').trim().replace(/\/+$/, '');
    const sqEmail  = (process.env.SQUARESPACE_EMAIL || '').trim();
    const sqPass   = (process.env.SQUARESPACE_PASSWORD || '').trim();

    if (siteUrl && sqEmail && sqPass) {
      try {
        const auth = await squarespaceLogin(siteUrl, sqEmail, sqPass);
        draftInfo = await createDraft(siteUrl, auth, title, html, collectionId);
      } catch (sqErr) {
        console.error('Squarespace draft failed:', sqErr.message);
        // Continue -- still queue to GitHub even if Squarespace fails
      }
    } else {
      console.log('Squarespace env vars not set -- skipping draft creation');
    }

    // ---- Queue to GitHub ----
    const now = new Date();
    const ts  = now.toISOString().replace(/[:.]/g, '-');
    const filePath = `pending/post-${ts}.json`;
    const queueObj = {
      docId: docId || 'unknown',
      title: title,
      html: html,
      plaintext: plaintext || '',
      createdAt: now.toISOString(),
      status: draftInfo ? 'published' : 'pending',
      squarespaceId: draftInfo ? draftInfo.id : null,
      squarespaceUrl: draftInfo ? draftInfo.fullUrl : null
    };

    const contentB64 = Buffer.from(JSON.stringify(queueObj, null, 2)).toString('base64');
    const destDir = draftInfo ? 'published' : 'pending';
    const destPath = `${destDir}/post-${ts}.json`;

    const ghRes = await ghRequest(
      `/repos/${OWNER}/${REPO}/contents/${destPath}`,
      'PUT',
      {
        message: draftInfo
          ? `Published: ${title} [skip netlify]`
          : `Queue post: ${title} [skip netlify]`,
        content: contentB64,
        branch: 'main'
      }
    );

    if (ghRes.status >= 200 && ghRes.status < 300) {
      const parsed = JSON.parse(ghRes.body);
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          status: 'ok',
          squarespace: draftInfo ? { id: draftInfo.id, url: draftInfo.fullUrl } : null,
          path: destPath,
          sha: parsed.content && parsed.content.sha,
          commitUrl: parsed.commit && parsed.commit.html_url
        })
      };
    }

    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ status: 'error', message: `GitHub API ${ghRes.status}`, body: ghRes.body })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ status: 'error', message: err.message })
    };
  }
};
