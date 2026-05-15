const { requireAdmin } = require('./require-admin');
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

async function av(params, apiKey) {
  const url = new URL('https://www.alphavantage.co/query');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('apikey', apiKey);
  const res = await fetch(url);
  const data = await res.json();
  if (data.Information || data.Note || data['Error Message']) {
    throw new Error(data.Information || data.Note || data['Error Message']);
  }
  return data;
}

function latestValue(seriesObj) {
  if (!seriesObj || typeof seriesObj !== 'object') return null;
  const key = Object.keys(seriesObj).sort().pop();
  return key ? { date: key, value: Number(seriesObj[key].SMA || seriesObj[key].RSI) } : null;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function money(v) {
  const n = num(v);
  if (n === null) return null;
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function summarizeOptions(raw, symbol) {
  const rows = raw?.data || raw?.options || [];
  if (!Array.isArray(rows) || !rows.length) return null;
  const firstExp = rows[0]?.expiration || rows[0]?.expiration_date;
  const near = firstExp ? rows.filter(r => (r.expiration || r.expiration_date) === firstExp) : rows.slice(0, 250);
  let callVol = 0, putVol = 0, callOi = 0, putOi = 0;
  near.forEach(r => {
    const type = String(r.type || r.contract_type || '').toLowerCase();
    const volume = num(r.volume) || 0;
    const oi = num(r.open_interest) || 0;
    if (type.includes('call')) { callVol += volume; callOi += oi; }
    if (type.includes('put')) { putVol += volume; putOi += oi; }
  });
  if (!callVol && !putVol && !callOi && !putOi) return null;
  const pcVolume = callVol ? putVol / callVol : null;
  return {
    symbol,
    expiration: firstExp || 'Nearest returned',
    callVolume: callVol,
    putVolume: putVol,
    callOpenInterest: callOi,
    putOpenInterest: putOi,
    putCallVolumeRatio: pcVolume,
    read: pcVolume === null ? 'Options data returned' : pcVolume > 1 ? 'Put volume heavier' : 'Call volume heavier'
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const adminBlock = requireAdmin(event, typeof headers !== 'undefined' ? headers : {});
  if (adminBlock) return adminBlock;


  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Missing ALPHA_VANTAGE_API_KEY' }) };

  const symbol = String((event.queryStringParameters || {}).ticker || '').trim().toUpperCase();
  if (!symbol) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ticker required' }) };

  try {
    const [overview, quote, sma50, sma200, rsi] = await Promise.all([
      av({ function: 'OVERVIEW', symbol }, apiKey),
      av({ function: 'GLOBAL_QUOTE', symbol }, apiKey),
      av({ function: 'SMA', symbol, interval: 'daily', time_period: '50', series_type: 'close' }, apiKey),
      av({ function: 'SMA', symbol, interval: 'daily', time_period: '200', series_type: 'close' }, apiKey),
      av({ function: 'RSI', symbol, interval: 'daily', time_period: '14', series_type: 'close' }, apiKey)
    ]);

    let options = null;
    let optionsError = null;
    try {
      const opt = await av({ function: 'REALTIME_OPTIONS', symbol }, apiKey);
      options = summarizeOptions(opt, symbol);
    } catch (e) {
      optionsError = e.message;
    }

    const q = quote['Global Quote'] || {};
    const price = num(q['05. price']) || num(overview['50DayMovingAverage']);
    const ma50 = latestValue(sma50['Technical Analysis: SMA'])?.value || num(overview['50DayMovingAverage']);
    const ma200 = latestValue(sma200['Technical Analysis: SMA'])?.value || num(overview['200DayMovingAverage']);
    const rsi14 = latestValue(rsi['Technical Analysis: RSI'])?.value;
    const trend = price && ma50 && ma200
      ? price > ma50 && ma50 > ma200 ? 'Uptrend'
      : price < ma50 && ma50 < ma200 ? 'Downtrend'
      : 'Mixed'
      : 'Not enough data';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        company: overview.Name || symbol,
        sector: overview.Sector || '',
        industry: overview.Industry || '',
        snapshot: {
          price,
          changePercent: q['10. change percent'] || null,
          marketCap: money(overview.MarketCapitalization),
          peRatio: overview.PERatio || null,
          analystTarget: num(overview.AnalystTargetPrice),
          beta: overview.Beta || null
        },
        technical: {
          sma50: ma50,
          sma200: ma200,
          rsi14,
          trend,
          priceVs50: price && ma50 ? ((price / ma50 - 1) * 100) : null,
          priceVs200: price && ma200 ? ((price / ma200 - 1) * 100) : null
        },
        options,
        optionsError
      })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};



