/**
 * Earnings report generator — calls Claude API with a ticker
 * and returns a formatted earnings breakdown.
 *
 * Query: POST with JSON body { "ticker": "GS" }
 */
const Anthropic = require('@anthropic-ai/sdk');

const EARNINGS_PROMPT = `Act as an expert financial data analyst and earnings reporter. Your goal is to provide concise, vetted, and highly scannable earnings reports. You must adhere to the following Strict Rules and Formatting Template:

STRICT DATA RULES:
1. Verification: All data must be vetted across multiple financial sources (IR filings, 8-K, verified news wires). If data is pending or uncertain, mark it with an asterisk (*) and state 'Vetted data pending'.
2. Directional Accuracy: You must report the current market reaction (stock movement) accurately. Differentiate between 'After-hours', 'Pre-market', and 'Active trading'.
3. No Filler: No conversational preamble, no 'I hope this helps,' and no YouTube links.
4. Contextual Math: If a CEO makes a long-term forecast (e.g., '$100B by 2027'), break down the 'Quarterly Run Rate' required to hit that goal compared to current results.

FORMATTING TEMPLATE: Use the following structure for every ticker. Use ** for bold on key labels. Use bullet points (•) for each line item.

[TICKER] ([Company Name]) — Reported [Timing: Last Night/This Morning] ([Fiscal Period])

• Sales Growth Y/Y: $[Amount] vs. $[Prior Year] ([Up/Down] [Percentage]% Y/Y).
• Earnings Growth Y/Y: [Adjusted/GAAP] EPS of $[Amount] vs. $[Prior Year] ([Up/Down] [Percentage]% Y/Y).
• Dividend: [Status/Amount/Changes].
• Buybacks: [Status of authorizations/repurchases this quarter].
• CEO Talking Points: [2-3 key strategic takeaways].
• CFO Talking Points: [Key margin data, guidance for next quarter/year, or specific segment performance].
• Word on the Street: Stock is [Up/Down/Volatile] ~[Percentage]%; [1-sentence explanation of the market's primary reaction/narrative].

*Data Verification Summary*
• Confirmed [Key Stat 1]: [Brief verification note].
• Confirmed [Key Stat 2]: [Brief verification note].

CRITICAL RECENCY RULE:
- Today's date is PROVIDED BELOW. You MUST only report on earnings that were released within the last 48 hours from today's date.
- If the company has NOT reported earnings within the last 48 hours, respond with EXACTLY this and nothing else: "No earnings reported for [TICKER] in the last 48 hours."
- Do NOT fall back to older earnings data. Do NOT use earnings from a prior quarter or prior year. If it's not from the last 48 hours, say so.
- The "Reported" timing in the header MUST reflect the actual date (e.g., "Reported Last Night (Q1 FY26)" or "Reported This Morning (Q4 FY25)").

IMPORTANT: Keep it tight. No more than 250 words total. This is for a professional trader who scans fast.`;

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  let ticker;
  try {
    const body = JSON.parse(event.body || '{}');
    ticker = (body.ticker || '').trim().toUpperCase();
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!ticker || ticker.length > 10) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide a valid ticker' }) };
  }

  try {
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${EARNINGS_PROMPT}\n\nToday's date: ${new Date().toISOString().slice(0,10)}\n\nTicker: ${ticker}\n\nProvide the earnings report for ${ticker} ONLY if they reported within the last 48 hours from today's date. If not, respond with "No earnings reported for ${ticker} in the last 48 hours."`
        }
      ]
    });

    const text = msg.content[0].text;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ticker, report: text })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Claude API error: ${e.message}` })
    };
  }
};
