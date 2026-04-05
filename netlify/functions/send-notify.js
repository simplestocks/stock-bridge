// netlify/functions/send-notify.js
// Sends a real email via Gmail SMTP using nodemailer + App Password.
// Called by the scheduled task (or any other Netlify function) to notify Nic
// of Squarespace publish success/failure. Lands in the actual inbox, not drafts.
//
// Required Netlify environment variables:
//   GMAIL_ADDRESS       e.g. racernic@gmail.com
//   GMAIL_APP_PASSWORD  16-char Google App Password (NOT the regular password)
//
// POST body: { "to": "racernic@gmail.com", "subject": "...", "text": "...", "html": "..." (optional) }
// Response:  { status: "sent", messageId } or { error: "..." }

const nodemailer = require('nodemailer');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.GMAIL_ADDRESS || !process.env.GMAIL_APP_PASSWORD) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GMAIL_ADDRESS or GMAIL_APP_PASSWORD env var not set' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const to = payload.to || process.env.GMAIL_ADDRESS;
  const subject = payload.subject || '(no subject)';
  const text = payload.text || '';
  const html = payload.html || null;

  if (!text && !html) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'either text or html body is required' })
    };
  }

  // Official nodemailer Gmail service shortcut + App Password auth.
  // Source: https://nodemailer.com/usage/using-gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_ADDRESS,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"Simple Stocks Auto" <${process.env.GMAIL_ADDRESS}>`,
      to,
      subject,
      text,
      ...(html ? { html } : {})
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent', messageId: info.messageId, accepted: info.accepted })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err.message || err) })
    };
  }
};
