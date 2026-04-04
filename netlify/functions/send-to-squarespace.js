// netlify/functions/send-to-squarespace.js
// Accepts a morning-note payload from alerts.html and queues it for the
// Cowork scheduled task by committing a JSON file to pending/ in the repo.
//
// Requires env var: GITHUB_TOKEN (contents:write on simplestocks/stock-bridge)

const https = require('https');

const OWNER = 'simplestocks';
const REPO  = 'stock-bridge';

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

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.GITHUB_TOKEN) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: 'GITHUB_TOKEN env var not set' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { docId, title, html, plaintext } = payload;

    if (!html || !title) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error', message: 'title and html are required' })
      };
    }

    // Build queue file
    const now = new Date();
    const ts  = now.toISOString().replace(/[:.]/g, '-'); // 2026-04-04T12-34-56-789Z
    const filePath = `pending/post-${ts}.json`;
    const queueObj = {
      docId: docId || 'unknown',
      title: title,
      html: html,
      plaintext: plaintext || '',
      createdAt: now.toISOString(),
      status: 'pending'
    };

    const contentB64 = Buffer.from(JSON.stringify(queueObj, null, 2)).toString('base64');

    const ghRes = await ghRequest(
      `/repos/${OWNER}/${REPO}/contents/${filePath}`,
      'PUT',
      {
        message: `Queue post: ${title} [skip netlify]`,
        content: contentB64,
        branch: 'main'
      }
    );

    if (ghRes.status >= 200 && ghRes.status < 300) {
      const parsed = JSON.parse(ghRes.body);
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ok',
          path: filePath,
          sha: parsed.content && parsed.content.sha,
          commitUrl: parsed.commit && parsed.commit.html_url
        })
      };
    }

    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: `GitHub API ${ghRes.status}`, body: ghRes.body })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: err.message })
    };
  }
};
