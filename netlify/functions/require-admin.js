const { isAuthed } = require('./admin-auth');

function requireAdmin(event, headers = {}) {
  if (isAuthed(event)) return null;
  return {
    statusCode: 401,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers
    },
    body: JSON.stringify({ error: 'Admin login required' })
  };
}

module.exports = { requireAdmin };
