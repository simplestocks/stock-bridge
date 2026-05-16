const { isAuthed, json } = require('./admin-auth');
const { readPosts } = require('./member-post-store');
const { adminOrigins, allowedOrigins, ticketSecret } = require('./member-feed-auth');

function check(name, ok, detail = '') {
  return { name, ok: Boolean(ok), detail };
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });
  if (!isAuthed(event)) return json(401, { error: 'Admin login required' });

  const checks = [
    check('Admin session', true, 'Admin cookie accepted'),
    check('Ticket secret', Boolean(ticketSecret()), ticketSecret() ? 'Configured' : 'Missing MEMBER_FEED_SECRET or ADMIN_SESSION_SECRET'),
    check('Member origins', allowedOrigins().length > 0, allowedOrigins().join(', ')),
    check('Admin origins', adminOrigins().length > 0, adminOrigins().join(', '))
  ];

  let posts = [];
  try {
    posts = await readPosts(event);
    checks.push(check('Blob storage', true, `${posts.length} post${posts.length === 1 ? '' : 's'} readable`));
  } catch (error) {
    checks.push(check('Blob storage', false, String(error.message || error)));
  }

  const lastPost = posts[0] ? {
    title: posts[0].title || '',
    date: posts[0].date || '',
    type: posts[0].type || ''
  } : null;

  return json(200, {
    ok: checks.every((item) => item.ok),
    checkedAt: new Date().toISOString(),
    postCount: posts.length,
    lastPost,
    checks,
    endpoints: {
      ticket: '/.netlify/functions/member-feed-ticket',
      feed: '/.netlify/functions/member-feed',
      health: '/.netlify/functions/member-feed-health',
      widget: '/squarespace-posts/widget.js'
    }
  });
};
