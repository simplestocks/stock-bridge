exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const { market_pulse, spx_tracker, mode } = JSON.parse(event.body);

    let prompt;

    if (mode === 'macro') {
      // Weekly macro events mode
      prompt = `${market_pulse}\n\nReturn your response as JSON with this exact structure:\n{"market_pulse":{"bias":"","suggestion":"[your formatted list here with \\n for line breaks]","verdict":"Good to send"},"spx_tracker":{"bias":"","suggestion":"","verdict":"Good to send"}}\n\nPut ALL your content in the market_pulse.suggestion field. Use plain text with \\n for line breaks. No markdown, no asterisks, no HTML.`;
    } else {
      // Normal assessment mode
      prompt = `You are a trading newsletter editor. Review these two sections of a morning note.

MARKET PULSE:
${market_pulse || '(empty)'}

SPX TRACKER:
${spx_tracker || '(empty)'}

Return ONLY valid JSON, no other text, no markdown, no backticks:
{
  "market_pulse": {
    "bias": "one sentence flagging any directional bias, or 'No bias detected'",
    "suggestion": "reworded version that sounds neutral and polished, preserving all facts",
    "verdict": "Good to send"
  },
  "spx_tracker": {
    "bias": "one sentence flagging any directional bias, or 'No bias detected'",
    "suggestion": "reworded version that sounds neutral and polished, preserving all facts",
    "verdict": "Good to send"
  }
}

Rules:
- verdict must be one of: Good to send / Minor tweaks / Needs revision
- suggestion must preserve ALL original facts, numbers, and levels
- Do not add new information
- Keep the same tone and length
- Return only the JSON object, nothing else`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text.trim();
    const result = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
