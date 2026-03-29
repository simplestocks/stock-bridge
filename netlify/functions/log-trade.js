const https = require('https');

function httpsRequest(url, method, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: method === 'POST' ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      } : {}
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (method === 'POST' && body) req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbylMAAYGSAXa7cFD6opqJFLvttlHRPy4lwH1ibtDGXz1mEq1lKMtMN_LGHYF9PhupF6/exec';

  try {
    const body = event.body;

    // Step 1: POST to Apps Script URL — this sends the data and gets 302
    const res1 = await httpsRequest(APPS_SCRIPT_URL, 'POST', body);

    // Step 2: Follow redirect with GET (not POST — this is the key)
    if (res1.status === 302 && res1.headers.location) {
      const res2 = await httpsRequest(res1.headers.location, 'GET', null);
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: res2.body || JSON.stringify({ status: 'ok' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: res1.body || JSON.stringify({ status: 'ok' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'error', message: err.message })
    };
  }
};
