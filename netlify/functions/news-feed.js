const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

function parseTerms(value) {
  return String(value || '')
    .split(/\s+OR\s+|,|\s+/i)
    .map(t => t.trim())
    .filter(t => t && t.toUpperCase() !== 'OR');
}

function normalizeTime(raw) {
  if (!raw || raw.length < 8) return raw || '';
  const iso = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}T${raw.slice(9,11) || '00'}:${raw.slice(11,13) || '00'}:00Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Missing ALPHA_VANTAGE_API_KEY' }) };
  }

  const params = event.queryStringParameters || {};
  const ticker = String(params.ticker || '').replace(/^\$/, '').trim().toUpperCase();
  const keyword = String(params.keyword || '').trim();
  const limit = Math.min(parseInt(params.limit || '12', 10) || 12, 50);

  if (!ticker) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ticker required' }) };
  }

  const avUrl = new URL('https://www.alphavantage.co/query');
  avUrl.searchParams.set('function', 'NEWS_SENTIMENT');
  avUrl.searchParams.set('tickers', ticker);
  avUrl.searchParams.set('sort', 'LATEST');
  avUrl.searchParams.set('limit', String(limit));
  avUrl.searchParams.set('apikey', apiKey);

  try {
    const res = await fetch(avUrl);
    const data = await res.json();

    if (!res.ok || data.Information || data.Note || data['Error Message']) {
      return {
        statusCode: res.ok ? 429 : res.status,
        headers,
        body: JSON.stringify({
          error: data.Information || data.Note || data['Error Message'] || 'Alpha Vantage request failed'
        })
      };
    }

    const keywordTerms = parseTerms(keyword).map(t => t.toLowerCase());
    const feed = Array.isArray(data.feed) ? data.feed : [];
    const items = feed
      .filter(item => {
        if (!keywordTerms.length) return true;
        const hay = `${item.title || ''} ${item.summary || ''} ${item.source || ''}`.toLowerCase();
        return keywordTerms.some(term => hay.includes(term.toLowerCase()));
      })
      .slice(0, limit)
      .map((item, idx) => {
        const tickerSentiment = (item.ticker_sentiment || []).find(t => String(t.ticker || '').toUpperCase() === ticker);
        const score = Number(tickerSentiment?.ticker_sentiment_score ?? item.overall_sentiment_score ?? 0);
        const sentiment = score > 0.15 ? 'Bullish' : score < -0.15 ? 'Bearish' : 'Neutral';
        return {
          id: `${Date.now()}-${idx}`,
          time: normalizeTime(item.time_published),
          source: item.source || 'Alpha Vantage',
          ticker,
          headline: item.title || '',
          summary: item.summary || '',
          url: item.url || '',
          sentiment,
          score,
          why: keywordTerms.length
            ? `Matched ${ticker} and keyword filter: ${keyword}`
            : `Matched ${ticker} news feed`
        };
      });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ticker, keyword, count: items.length, items })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
