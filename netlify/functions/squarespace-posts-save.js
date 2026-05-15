const https = require('https');

const OWNER = 'simplestocks';
const REPO = 'stock-bridge';
const BRANCH = 'main';
const POSTS_PATH = 'public/squarespace-posts/posts.json';
const RSS_PATH = 'public/squarespace-posts/feed.xml';

function ghRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      host: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${path}`,
      method,
      headers: {
        'User-Agent': 'squarespace-posts-poc',
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
        let parsed = {};
        try { parsed = chunks ? JSON.parse(chunks) : {}; } catch (e) { parsed = { raw: chunks }; }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
        reject(new Error(`GitHub ${method} ${path} -> ${res.statusCode}: ${chunks}`));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `post-${Date.now()}`;
}

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cdata(value) {
  return String(value == null ? '' : value).replace(/\]\]>/g, ']]]]><![CDATA[>');
}

function buildRss(posts) {
  const items = posts.slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((post) => {
      const categories = (post.tags || []).map((tag) => `      <category>${xmlEscape(tag)}</category>`).join('\n');
      return [
        '    <item>',
        `      <title>${xmlEscape(post.title)}</title>`,
        `      <link>https://simplestocks.com/member-feed#${xmlEscape(post.id)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(post.id)}</guid>`,
        `      <pubDate>${new Date(post.date).toUTCString()}</pubDate>`,
        categories,
        `      <description><![CDATA[${cdata(post.body || post.summary || '')}]]></description>`,
        '    </item>'
      ].filter(Boolean).join('\n');
    }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>SimpleStocks Member Feed Proof</title>',
    '    <link>https://simplestocks.com/</link>',
    '    <description>Proof of concept feed for SimpleStocks member posts.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method Not Allowed' });
  if (!process.env.GITHUB_TOKEN) return jsonResponse(500, { error: 'GITHUB_TOKEN not set' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (e) { return jsonResponse(400, { error: 'Invalid JSON body' }); }

  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!title || !body) return jsonResponse(400, { error: 'title and body are required' });

  const date = payload.date ? new Date(payload.date) : new Date();
  if (isNaN(date.getTime())) return jsonResponse(400, { error: 'date is invalid' });

  const tags = Array.isArray(payload.tags)
    ? payload.tags.map(String)
    : String(payload.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);

  try {
    const current = await ghRequest('GET', `/contents/${POSTS_PATH}?ref=${BRANCH}`);
    const posts = JSON.parse(Buffer.from(current.content, 'base64').toString('utf8'));
    const post = {
      id: `${slugify(title)}-${date.toISOString().slice(0, 10)}`,
      date: date.toISOString(),
      type: String(payload.type || 'update').trim() || 'update',
      title,
      summary: String(payload.summary || '').trim() || body.slice(0, 140),
      body,
      tags,
      author: String(payload.author || 'Nic').trim() || 'Nic'
    };
    const nextPosts = [post, ...posts.filter((p) => p.id !== post.id)];
    const postsContent = Buffer.from(JSON.stringify(nextPosts, null, 2) + '\n', 'utf8').toString('base64');
    const rssContent = Buffer.from(buildRss(nextPosts), 'utf8').toString('base64');

    await ghRequest('PUT', `/contents/${POSTS_PATH}`, {
      message: `Add Squarespace feed post: ${post.title}`,
      content: postsContent,
      sha: current.sha,
      branch: BRANCH
    });

    let rssSha = null;
    try {
      const rss = await ghRequest('GET', `/contents/${RSS_PATH}?ref=${BRANCH}`);
      rssSha = rss.sha;
    } catch (e) {}

    await ghRequest('PUT', `/contents/${RSS_PATH}`, {
      message: `Update Squarespace feed RSS for: ${post.title}`,
      content: rssContent,
      ...(rssSha ? { sha: rssSha } : {}),
      branch: BRANCH
    });

    return jsonResponse(200, { ok: true, post, count: nextPosts.length });
  } catch (err) {
    return jsonResponse(500, { error: String(err.message || err) });
  }
};
