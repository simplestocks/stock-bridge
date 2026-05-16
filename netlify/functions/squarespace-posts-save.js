const { isAuthed, json } = require('./admin-auth');
const { readPosts, writePosts } = require('./member-post-store');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `post-${Date.now()}`;
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
  if (!isAuthed(event)) return json(401, { error: 'Admin login required' });

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
    const posts = await readPosts(event);
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
    await writePosts(nextPosts, event);

    return jsonResponse(200, { ok: true, post, count: nextPosts.length });
  } catch (err) {
    return jsonResponse(500, { error: String(err.message || err) });
  }
};
