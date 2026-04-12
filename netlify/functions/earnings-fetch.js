/**
 * On-demand earnings calendar fetch via Nasdaq public API.
 * Query params:
 *   offset=0  → current week (default)
 *   offset=7  → next week
 *   offset=14 → two weeks out
 */
const MIN_MARKET_CAP = 10_000_000_000; // $10B

function parseMarketCap(s) {
  if (!s || s === 'N/A' || s === '--') return 0;
  return parseInt(s.replace(/[$,]/g, '').trim(), 10) || 0;
}

function weekDates(offsetDays) {
  // Build Mon-Fri in PT for current week + offset
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() + (offsetDays || 0));
  const day = shifted.getDay(); // 0=Sun..6=Sat
  let monday;
  if (day === 0) {
    monday = new Date(shifted); monday.setDate(shifted.getDate() + 1);
  } else if (day === 6) {
    monday = new Date(shifted); monday.setDate(shifted.getDate() + 2);
  } else {
    monday = new Date(shifted); monday.setDate(shifted.getDate() - (day - 1));
  }
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

async function fetchDay(d) {
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${fmtDate(d)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });
  if (!res.ok) return [];
  const json = await res.json();
  const rows = ((json || {}).data || {}).rows || [];
  const out = [];
  for (const r of rows) {
    const sym = (r.symbol || '').trim();
    const mc = parseMarketCap(r.marketCap);
    if (!sym || mc < MIN_MARKET_CAP) continue;
    const tcode = (r.time || '').toLowerCase();
    let when = 'OTH';
    if (tcode.includes('pre-market')) when = 'BMO';
    else if (tcode.includes('after-hours')) when = 'AMC';
    out.push({ symbol: sym, name: (r.name || '').trim(), market_cap: mc, when });
  }
  out.sort((a, b) => b.market_cap - a.market_cap);
  return out;
}

function formatDayLine(d, events) {
  const bmo = events.filter(e => e.when === 'BMO').map(e => e.symbol);
  const amc = events.filter(e => e.when === 'AMC').map(e => e.symbol);
  const oth = events.filter(e => e.when === 'OTH').map(e => e.symbol);
  const left = bmo.length ? bmo.join(' ') : '\u2014';
  const rightParts = [];
  if (amc.length) rightParts.push(amc.join(' '));
  if (oth.length) rightParts.push('(' + oth.join(' ') + ')');
  const right = rightParts.length ? rightParts.join(' ') : '\u2014';
  return `${dayLabel(d)}: ${left} | ${right}`;
}

exports.handler = async function(event) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const offset = parseInt((event.queryStringParameters || {}).offset || '0', 10);
  if (![0, 7, 14].includes(offset)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'offset must be 0, 7, or 14' }) };
  }

  try {
    const days = weekDates(offset);
    const allEvents = {};
    const lines = [];
    const errors = [];

    for (const d of days) {
      try {
        const events = await fetchDay(d);
        allEvents[fmtDate(d)] = events;
        lines.push(formatDayLine(d, events));
      } catch (e) {
        errors.push(`${fmtDate(d)}: ${e.message}`);
        allEvents[fmtDate(d)] = [];
        lines.push(formatDayLine(d, []));
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        generated_at: new Date().toISOString(),
        week_start: fmtDate(days[0]),
        week_end: fmtDate(days[4]),
        offset,
        min_market_cap: MIN_MARKET_CAP,
        events_by_day: allEvents,
        earnings_text: lines.join('\n'),
        errors
      })
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
