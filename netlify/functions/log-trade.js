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
      res.on('end', () => resolve({ 
        status: res.statusCode, 
        headers: res.headers, 
        body: data 
      }));
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

  const debugLog = [];

  try {
    const body = event.body;
    debugLog.push(`Step 1: POSTing to Apps Script URL`);
    
    const res1 = await httpsRequest(APPS_SCRIPT_URL, 'POST', body);
    debugLog.push(`Step 1 result: status=${res1.status}, location=${res1.headers.location || 'none'}`);

    if (res1.status === 302 && res1.headers.location) {
      debugLog.push(`Step 2: Following redirect with GET to ${res1.headers.location}`);
      const res2 = await httpsRequest(res1.headers.location, 'GET', null);
      debugLog.push(`Step 2 result: status=${res2.status}, body=${res2.body.substring(0,100)}`);
      
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ok', debug: debugLog, response: res2.body })
      };
    }

    debugLog.push(`No redirect — status was ${res1.status}`);
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok', debug: debugLog, response: res1.body })
    };

  } catch (err) {
    debugLog.push(`Error: ${err.message}`);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'error', message: err.message, debug: debugLog })
    };
  }
};
