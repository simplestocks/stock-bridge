exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbylMAAYGSAXa7cFD6opqJFLvttlHRPy4lwH1ibtDGXz1mEq1lKMtMN_LGHYF9PhupF6/exec';

  try {
    const body = JSON.parse(event.body);
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });

    const text = await response.text();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'error', message: err.message })
    };
  }
};
