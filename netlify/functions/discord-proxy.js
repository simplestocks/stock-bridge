const { requireAdmin } = require('./require-admin');

const MAX_CONTENT_CHARS = 1900;
const MAX_RETRY_WAIT_MS = 8000;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function withWait(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('wait', 'true');
  return parsed.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitContent(content) {
  const text = String(content || '').trim();
  if (!text) return [];
  const chunks = [];
  let remaining = text;

  while (remaining.length > MAX_CONTENT_CHARS) {
    let idx = remaining.lastIndexOf('\n\n', MAX_CONTENT_CHARS);
    if (idx < 500) idx = remaining.lastIndexOf('\n', MAX_CONTENT_CHARS);
    if (idx < 500) idx = remaining.lastIndexOf(' ', MAX_CONTENT_CHARS);
    if (idx < 500) idx = MAX_CONTENT_CHARS;

    chunks.push(remaining.slice(0, idx).trim());
    remaining = remaining.slice(idx).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function readDiscordError(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text || response.statusText || `HTTP ${response.status}` };
  }
}

async function postToDiscord(discordUrl, payload) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(withWait(discordUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) return { ok: true };

    const errorBody = await readDiscordError(response);
    const retryAfterSeconds = Number(errorBody.retry_after || response.headers.get('retry-after') || 0);
    const retryWaitMs = retryAfterSeconds * 1000;

    if (response.status === 429 && attempt === 0 && retryWaitMs > 0 && retryWaitMs <= MAX_RETRY_WAIT_MS) {
      await sleep(retryWaitMs + 250);
      continue;
    }

    return {
      ok: false,
      status: response.status,
      error: errorBody.message || errorBody.error || JSON.stringify(errorBody),
      retryAfter: retryAfterSeconds || null,
      rateLimited: response.status === 429
    };
  }

  return { ok: false, error: 'Discord send failed after retry' };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });

  const adminBlock = requireAdmin(event);
  if (adminBlock) return adminBlock;

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method Not Allowed' });
  }

  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!discordUrl) {
    return jsonResponse(500, { ok: false, error: 'DISCORD_WEBHOOK_URL not set' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
  }

  const hasEmbeds = Array.isArray(body.embeds) && body.embeds.length > 0;
  const chunks = splitContent(body.content);

  if (!chunks.length && !hasEmbeds) {
    return jsonResponse(400, { ok: false, error: 'Discord payload needs content or embeds' });
  }

  if (hasEmbeds) {
    const result = await postToDiscord(discordUrl, {
      ...body,
      allowed_mentions: body.allowed_mentions || { parse: [] }
    });
    return jsonResponse(200, result);
  }

  for (let index = 0; index < chunks.length; index += 1) {
    const result = await postToDiscord(discordUrl, {
      ...body,
      content: chunks[index],
      allowed_mentions: body.allowed_mentions || { parse: [] }
    });

    if (!result.ok) {
      return jsonResponse(200, {
        ...result,
        sentChunks: index,
        totalChunks: chunks.length
      });
    }

    if (index < chunks.length - 1) await sleep(350);
  }

  return jsonResponse(200, { ok: true, chunks: chunks.length });
};
