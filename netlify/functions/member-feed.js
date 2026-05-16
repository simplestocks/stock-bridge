const { readPosts } = require('./member-post-store');
const { corsHeaders, isAllowed, requestOrigin, verifyTicket } = require('./member-feed-auth');
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
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Member-Token',
        'Cache-Control': 'no-store',
        'Vary': 'Origin'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') return response(405, { error: 'Method Not Allowed' }, origin);
  if (!isAllowed(event, { allowAdmin })) return response(403, { error: 'Forbidden' });
  const ticket = event.queryStringParameters?.token || event.headers['x-member-token'] || event.headers['X-Member-Token'];
  const ticketCheck = verifyTicket(ticket);
  if (!ticketCheck.ok) return response(403, { error: 'Feed ticket denied', reason: ticketCheck.reason }, origin);

  try {
    const posts = await readPosts(event);
    return response(200, posts, origin);
  } catch (error) {
    return response(500, { error: 'Feed unavailable' }, origin);
  }
};
