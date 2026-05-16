const { DEFAULT_TTL_SECONDS, corsHeaders, isAllowed, makeTicket, requestOrigin, ticketSecret } = require('./member-feed-auth');
const { isAuthed } = require('./admin-auth');

function response(statusCode, body, origin = '') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin)
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event) {
  const origin = requestOrigin(event);
  const allowAdmin = isAuthed(event);

  if (event.httpMethod === 'OPTIONS') {
    if (!isAllowed(event, { allowAdmin })) return response(403, { error: 'Forbidden' });
    return {
      statusCode: 204,
      headers: {
        'Cache-Control': 'no-store',
        ...corsHeaders(origin)
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') return response(405, { error: 'Method Not Allowed' }, origin);
  if (!isAllowed(event, { allowAdmin })) return response(403, { error: 'Forbidden' }, origin);
  if (!ticketSecret()) return response(500, { error: 'Ticket secret is not configured' }, origin);

  return response(200, {
    ok: true,
    token: makeTicket(DEFAULT_TTL_SECONDS),
    expiresIn: DEFAULT_TTL_SECONDS
  }, origin);
};
