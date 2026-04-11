exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const DISCORD_URL = process.env.DISCORD_WEBHOOK_URL;

  if (!DISCORD_URL) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: 'DISCORD_WEBHOOK_URL not set' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const response = await fetch(DISCORD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const txt = await response.text();
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: false, status: response.status, error: txt })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
