// netlify/functions/mark-published.js
// Moves a file from pending/ to published/ in the simplestocks/stock-bridge GitHub repo.
// Called by the scheduled task after a Squarespace draft has been successfully saved.
//
// POST body: { "path": "pending/post-2026-04-04T20-42-41-730Z.json", "squarespaceDraftUrl": "..." (optional) }
// Response:  { status: "moved", from, to, deleteSha, createSha }

const https = require('https');

const OWNER  = 'simplestocks';
const REPO   = 'stock-bridge';
const BRANCH = 'main';

function ghRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      host: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${path}`,
      method,
      headers: {
        'User-Agent': 'stock-bridge-netlify-fn',
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const parsed = chunks ? JSON.parse(chunks) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          return reject(new Error(`GitHub ${method} ${path} -> ${res.statusCode}: ${chunks}`));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.GITHUB_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GITHUB_TOKEN not set' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const srcPath = payload.path;
  const draftUrl = payload.squarespaceDraftUrl || null;

  if (!srcPath || !srcPath.startsWith('pending/')) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'path must be provided and start with pending/' })
    };
  }

  const dstPath = srcPath.replace(/^pending\//, 'published/');

  try {
    // 1. Read the existing pending file (content + sha)
    const getRes = await ghRequest('GET', `/contents/${encodeURIComponent(srcPath).replace(/%2F/g, '/')}?ref=${BRANCH}`);
    const srcSha = getRes.sha;
    const contentBase64 = getRes.content; // already base64

    // Decode, add publishedAt + draftUrl, re-encode
    const decoded = Buffer.from(contentBase64, 'base64').toString('utf8');
    let obj;
    try { obj = JSON.parse(decoded); } catch (e) { obj = { raw: decoded }; }
    obj.status = 'published';
    obj.publishedAt = new Date().toISOString();
    if (draftUrl) obj.squarespaceDraftUrl = draftUrl;
    const newContentB64 = Buffer.from(JSON.stringify(obj, null, 2), 'utf8').toString('base64');

    // 2. Create the published/ file
    const createRes = await ghRequest('PUT', `/contents/${dstPath}`, {
      message: `Publish: move ${srcPath} -> ${dstPath} [skip netlify]`,
      content: newContentB64,
      branch: BRANCH
    });

    // 3. Delete the pending/ file
    const deleteRes = await ghRequest('DELETE', `/contents/${srcPath}`, {
      message: `Remove queued file ${srcPath} after publish [skip netlify]`,
      sha: srcSha,
      branch: BRANCH
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'moved',
        from: srcPath,
        to: dstPath,
        createSha: createRes.content && createRes.content.sha,
        deleteSha: deleteRes.commit && deleteRes.commit.sha
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err.message || err) })
    };
  }
};
