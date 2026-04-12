#!/usr/bin/env node
// scripts/squarespace-publish.js
// ---------------------------------------------------------------
// Runs inside GitHub Actions. Reads pending/*.json files from the
// repo, logs in to Squarespace via the internal API, creates each
// post as a DRAFT, then moves the file from pending/ to published/.
//
// Required env vars:
//   SQUARESPACE_EMAIL    – Squarespace account email
//   SQUARESPACE_PASSWORD – Squarespace account password
//   SQUARESPACE_SITE_URL – e.g. https://simplestocks.squarespace.com
//   GITHUB_TOKEN         – PAT with contents:write on the repo
// ---------------------------------------------------------------

const https = require('https');
const { URL } = require('url');

// ---------- CONFIG ----------
const OWNER  = 'simplestocks';
const REPO   = 'stock-bridge';
const BRANCH = 'main';

// Squarespace collection IDs
const COLLECTIONS = {
  'morning-note': '635dd55df0e2db5da59ef527',
  'trade-alert':  '63e597a94c7f135688639956'
};
const DEFAULT_COLLECTION = COLLECTIONS['morning-note'];

// ---------- HTTP HELPERS ----------

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

function ghApi(method, path, body) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${path}`,
      method,
      headers: {
        'User-Agent': 'stock-bridge-publisher',
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request(opts, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          const parsed = chunks ? JSON.parse(chunks) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ---------- COOKIE HELPERS ----------

function extractCookiePairs(setCookies) {
  const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
  return arr.map(sc => sc.split(';')[0]); // "name=value"
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

// ---------- SQUARESPACE AUTH ----------

async function squarespaceLogin(siteUrl, email, password) {

  // Step 0: GET site root to obtain initial crumb + session cookies
  console.log('  Step 0: GET site root to get initial crumb ...');
  const initRes = await request(`${siteUrl}/`, { method: 'GET' });

  if (initRes.status >= 400) {
    throw new Error(`Step 0 GET / failed: ${initRes.status}`);
  }

  let cookiePairs = [];
  if (initRes.headers['set-cookie']) {
    cookiePairs = extractCookiePairs(initRes.headers['set-cookie']);
  }

  // Extract initial crumb from cookies
  const initCookieStr = cookiePairs.join('; ');
  const initCrumbMatch = initCookieStr.match(/crumb=([^;]+)/);
  const initCrumb = initCrumbMatch ? initCrumbMatch[1] : '';
  console.log(`  Initial crumb obtained: ${initCrumb ? 'yes' : 'no'}`);

  // Step 1: POST /api/auth/Login with form-encoded credentials + cookies from step 0
  console.log('  Step 1: POST /api/auth/Login ...');
  const formBody = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const loginRes = await request(`${siteUrl}/api/auth/Login?crumb=${initCrumb}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formBody),
      'Cookie': initCookieStr,
      'Origin': siteUrl,
      'Referer': siteUrl
    },
    body: formBody
  });

  if (loginRes.status !== 200) {
    throw new Error(`Login step 1 failed: ${loginRes.status} ${loginRes.body.substring(0, 300)}`);
  }

  // Merge new cookies from login response
  if (loginRes.headers['set-cookie']) {
    cookiePairs = mergeCookies(cookiePairs, loginRes.headers['set-cookie']);
  }

  const loginJson = JSON.parse(loginRes.body);
  const tokenLoginUrl = loginJson.targetWebsite && loginJson.targetWebsite.loginUrl;

  if (!tokenLoginUrl) {
    // Some accounts may not need the token exchange step -- check if we already have auth
    console.log('  No targetWebsite.loginUrl -- checking if already authenticated...');
    const finalCookieStr = cookiePairs.join('; ');
    const finalCrumbMatch = finalCookieStr.match(/crumb=([^;]+)/);
    if (finalCrumbMatch) {
      return {
        crumb: finalCrumbMatch[1],
        cookieHeader: finalCookieStr
      };
    }
    throw new Error('Login step 1 did not return targetWebsite.loginUrl and no crumb found');
  }

  console.log('  Step 2: Token exchange at loginUrl ...');

  // Step 2: GET the tokenLogin URL with credentials as query params
  const sep = tokenLoginUrl.includes('?') ? '&' : '?';
  const tokenUrl = `${tokenLoginUrl}${sep}email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const tokenRes = await request(tokenUrl, {
    method: 'GET',
    headers: {
      'Cookie': cookiePairs.join('; ')
    }
  });
  if (tokenRes.status < 200 || tokenRes.status >= 400) {
    throw new Error(`Login step 2 failed: ${tokenRes.status}`);
  }

  // Merge all cookies
  if (tokenRes.headers['set-cookie']) {
    cookiePairs = mergeCookies(cookiePairs, tokenRes.headers['set-cookie']);
  }

  const finalCookieStr = cookiePairs.join('; ');
  const crumbMatch = finalCookieStr.match(/crumb=([^;]+)/);
  if (!crumbMatch) {
    throw new Error('Could not extract crumb from cookies after login');
  }

  return {
    crumb: crumbMatch[1],
    cookieHeader: finalCookieStr
  };
}

// ---------- SQUARESPACE CREATE DRAFT ----------

async function createDraft(siteUrl, auth, title, html, collectionId) {
  const payload = JSON.stringify({
    title: title,
    collectionId: collectionId || DEFAULT_COLLECTION,
    workflowState: 4,  // 4 = Draft
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
      'Content-Length': Buffer.byteLength(payload),
      'Cookie': auth.cookieHeader
    },
    body: payload
  });

  if (res.status !== 200) {
    throw new Error(`Create draft failed: ${res.status} ${res.body.substring(0, 300)}`);
  }

  const result = JSON.parse(res.body);
  return {
    id: result.id,
    title: result.title,
    fullUrl: result.fullUrl,
    urlId: result.urlId
  };
}

// ---------- GITHUB: LIST PENDING FILES ----------

async function listPendingFiles() {
  const res = await ghApi('GET', '/contents/pending?ref=' + BRANCH);
  if (res.status === 404) return []; // no pending directory
  if (res.status !== 200) {
    throw new Error(`Failed to list pending/: ${res.status} ${JSON.stringify(res.data)}`);
  }
  // Filter to .json files only
  return (Array.isArray(res.data) ? res.data : [])
    .filter(f => f.name.endsWith('.json'))
    .map(f => ({ name: f.name, path: f.path, sha: f.sha, download_url: f.download_url }));
}

// ---------- GITHUB: READ FILE CONTENT ----------

async function readFileContent(filePath) {
  const res = await ghApi('GET', `/contents/${filePath}?ref=${BRANCH}`);
  if (res.status !== 200) {
    throw new Error(`Failed to read ${filePath}: ${res.status}`);
  }
  const content = Buffer.from(res.data.content, 'base64').toString('utf8');
  return { content: JSON.parse(content), sha: res.data.sha };
}

// ---------- GITHUB: MOVE PENDING -> PUBLISHED ----------

async function moveToPublished(srcPath, sha, originalContent, draftInfo) {
  const dstPath = srcPath.replace(/^pending\//, 'published/');

  // Update the content with publish info
  const updatedObj = {
    ...originalContent,
    status: 'published',
    publishedAt: new Date().toISOString(),
    squarespaceId: draftInfo.id,
    squarespaceUrl: draftInfo.fullUrl
  };

  const newContentB64 = Buffer.from(JSON.stringify(updatedObj, null, 2)).toString('base64');

  // Create in published/
  const createRes = await ghApi('PUT', `/contents/${dstPath}`, {
    message: `Published: ${originalContent.title} [skip netlify]`,
    content: newContentB64,
    branch: BRANCH
  });

  if (createRes.status < 200 || createRes.status >= 300) {
    throw new Error(`Failed to create ${dstPath}: ${createRes.status} ${JSON.stringify(createRes.data)}`);
  }

  // Delete from pending/
  const delRes = await ghApi('DELETE', `/contents/${srcPath}`, {
    message: `Remove queued ${srcPath} [skip netlify]`,
    sha: sha,
    branch: BRANCH
  });

  if (delRes.status < 200 || delRes.status >= 300) {
    throw new Error(`Failed to delete ${srcPath}: ${delRes.status}`);
  }

  return dstPath;
}

// ---------- MAIN ----------

async function main() {
  const siteUrl  = (process.env.SQUARESPACE_SITE_URL || '').trim().replace(/\/+$/, '');
  const email    = (process.env.SQUARESPACE_EMAIL || '').trim();
  const password = (process.env.SQUARESPACE_PASSWORD || '').trim();

  if (!siteUrl || !email || !password) {
    console.error('Missing env vars: SQUARESPACE_SITE_URL, SQUARESPACE_EMAIL, SQUARESPACE_PASSWORD');
    process.exit(1);
  }
  if (!process.env.GITHUB_TOKEN) {
    console.error('Missing env var: GITHUB_TOKEN');
    process.exit(1);
  }

  // 1. List pending files
  console.log('Checking for pending posts...');
  const pendingFiles = await listPendingFiles();

  if (pendingFiles.length === 0) {
    console.log('No pending posts. Done.');
    return;
  }

  console.log(`Found ${pendingFiles.length} pending post(s).`);

  // 2. Log in to Squarespace (only if there are files to process)
  console.log('Logging in to Squarespace...');
  const auth = await squarespaceLogin(siteUrl, email, password);
  console.log('  Login successful. Crumb obtained.');

  // 3. Process each pending file
  let successCount = 0;
  let failCount = 0;

  for (const file of pendingFiles) {
    console.log(`\nProcessing: ${file.name}`);
    try {
      // Read file content
      const { content, sha } = await readFileContent(file.path);
      console.log(`  Title: ${content.title}`);

      // Determine collection from docId or default
      let collectionId = DEFAULT_COLLECTION;
      if (content.docId && content.docId.includes('trade-alert')) {
        collectionId = COLLECTIONS['trade-alert'];
      }

      // Create Squarespace draft
      console.log('  Creating Squarespace draft...');
      const draftInfo = await createDraft(siteUrl, auth, content.title, content.html, collectionId);
      console.log(`  Draft created: ${draftInfo.id} -> ${draftInfo.fullUrl}`);

      // Move file from pending to published
      console.log('  Moving to published/...');
      const dstPath = await moveToPublished(file.path, sha, content, draftInfo);
      console.log(`  Moved to ${dstPath}`);

      successCount++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\nDone. ${successCount} succeeded, ${failCount} failed.`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
