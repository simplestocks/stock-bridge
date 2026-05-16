const fs = require('fs');
const path = require('path');
const { checkPassword, clearCookie, isAuthed, makeCookie } = require('./admin-auth');

const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const FILES = {
  'writer.html': 'public/squarespace-posts/writer.html',
  'styles.css': 'public/squarespace-posts/styles.css',
  'widget.js': 'public/squarespace-posts/widget.js',
  'index.html': 'public/squarespace-posts/index.html',
  'posts.json': 'public/squarespace-posts/posts.json',
  'feed.xml': 'public/squarespace-posts/feed.xml',
  'alerts.html': 'public/alerts.html',
  'command-center.html': 'public/command-center.html',
  'odte-dashboard.html': 'public/odte-dashboard.html'
};

function html(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    },
    body
  };
}

function redirect(location, headers = {}) {
  return {
    statusCode: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      ...headers
    },
    body: ''
  };
}

function loginPage(message = '') {
  return html(200, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SimpleStocks Admin</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#090d14; color:#e8eef8; font-family:Arial,Helvetica,sans-serif; }
    form { width:min(420px, calc(100% - 32px)); border:1px solid #263244; border-radius:10px; background:#121927; padding:24px; display:grid; gap:12px; }
    h1 { margin:0; font-size:24px; }
    p { margin:0; color:#9daabe; line-height:1.4; }
    input, button { min-height:42px; border-radius:7px; font:inherit; }
    input { border:1px solid #334156; background:#0b111d; color:#fff; padding:0 12px; }
    button { border:0; background:#4ea1ff; color:#06101f; font-weight:800; cursor:pointer; }
    .err { color:#ff8585; min-height:18px; font-size:13px; }
  </style>
</head>
<body>
  <form method="post" action="/.netlify/functions/admin?path=login">
    <h1>SimpleStocks Admin</h1>
    <p>Private tools are locked. Enter the admin password.</p>
    <input name="password" type="password" autocomplete="current-password" autofocus>
    <button type="submit">Enter</button>
    <div class="err">${escapeHtml(message)}</div>
  </form>
</body>
</html>`);
}

function homePage() {
  return html(200, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SimpleStocks Admin</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; background:#090d14; color:#e8eef8; font-family:Arial,Helvetica,sans-serif; padding:28px; }
    main { max-width:880px; margin:0 auto; }
    h1 { margin:0 0 16px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
    a { display:block; border:1px solid #263244; border-radius:9px; background:#121927; color:#e8eef8; padding:16px; text-decoration:none; font-weight:800; }
    a span { display:block; margin-top:6px; color:#9daabe; font-weight:400; font-size:13px; }
    a.railway { border-color:#79b8ff; background:#10243d; color:#d9ecff; }
    a.railway span { color:#9fc9f5; }
    a.event-app { border-color:#ffb454; background:#3a2209; color:#ffe1b5; }
    a.event-app span { color:#ffc977; }
    .top { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
    .logout { border-color:#49313a; color:#ffb0b0; }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <h1>SimpleStocks Admin</h1>
      <a class="logout" href="/.netlify/functions/admin?path=logout">Log out</a>
    </div>
    <div class="grid">
      <a href="/.netlify/functions/admin?path=writer.html">Post Writer<span>Create member feed posts.</span></a>
      <a href="/.netlify/functions/admin?path=alerts.html">Alert Generator<span>Morning notes, alerts, trades.</span></a>
      <a href="/.netlify/functions/admin?path=command-center.html">Command Center<span>Old Hilo dashboard.</span></a>
      <a href="/.netlify/functions/admin?path=odte-dashboard.html">0DTE Dashboard<span>Netlify dashboard shell.</span></a>
      <a href="/.netlify/functions/admin?path=index.html">Feed Viewer<span>Protected feed test page.</span></a>
      <a class="event-app" href="https://script.google.com/macros/s/AKfycbzap3pKAGdBirffsG5BbSqhkfbdd_kUInpyFVKidrBTr-Kk-n34NYc4jMR3qr-MrV5z/exec" target="_blank" rel="noreferrer">Event Manager<span>Apps Script event dashboard.</span></a>
      <a class="railway" href="https://magix-production.up.railway.app/" target="_blank" rel="noreferrer">Magix Railway<span>Live Railway dashboard root.</span></a>
      <a class="railway" href="https://magix-production.up.railway.app/viewer.html" target="_blank" rel="noreferrer">Magix Viewer<span>Live Railway viewer page.</span></a>
    </div>
  </main>
</body>
</html>`);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseForm(event) {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : String(event.body || '');
  return new URLSearchParams(body);
}

function serveFile(name) {
  const rel = FILES[name];
  if (!rel) return html(404, 'Not found');
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT) || !fs.existsSync(abs)) return html(404, 'Not found');
  let body = fs.readFileSync(abs, 'utf8');
  if (name === 'writer.html' || name === 'index.html') {
    body = body.replaceAll('./styles.css', '/.netlify/functions/admin?path=styles.css')
      .replaceAll('./widget.js', '/.netlify/functions/admin?path=widget.js')
      .replaceAll('./posts.json', '/.netlify/functions/admin?path=posts.json')
      .replaceAll('./feed.xml', '/.netlify/functions/admin?path=feed.xml')
      .replaceAll('./index.html', '/.netlify/functions/admin?path=index.html')
      .replaceAll('./writer.html', '/.netlify/functions/admin?path=writer.html');
  }
  if (name.endsWith('.html')) body = rewriteAdminLinks(body);
  if (name.endsWith('.html')) body = injectAdminBackButton(body);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': MIME[path.extname(name)] || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body
  };
}

function rewriteAdminLinks(body) {
  return body
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/command-center.html', '/.netlify/functions/admin?path=command-center.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/command-center', '/.netlify/functions/admin?path=command-center.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/odte-dashboard.html', '/.netlify/functions/admin?path=odte-dashboard.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/alerts.html', '/.netlify/functions/admin?path=alerts.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/squarespace-posts/writer.html', '/.netlify/functions/admin?path=writer.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/squarespace-posts/index.html', '/.netlify/functions/admin?path=index.html');
}

function injectAdminBackButton(body) {
  const bar = `
<style>
  .ss-admin-back {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 99999;
    min-height: 28px;
    padding: 6px 10px;
    border: 1px solid rgba(255,255,255,.28);
    border-radius: 6px;
    background: rgba(6,10,18,.92);
    color: #f4f8ff;
    font: 800 12px/1 Arial, Helvetica, sans-serif;
    text-decoration: none;
    box-shadow: 0 8px 28px rgba(0,0,0,.28);
  }
  .ss-admin-back:hover { background: #1d6fe8; color: #fff; }
  body { padding-top: max(28px, env(safe-area-inset-top)); }
</style>
<a class="ss-admin-back" href="/.netlify/functions/admin">Admin</a>`;
  if (body.includes('</body>')) return body.replace('</body>', `${bar}</body>`);
  return `${bar}${body}`;
}

exports.handler = async function(event) {
  const rawPath = String(event.queryStringParameters?.path || '').replace(/^\/+/, '') || '';
  const cleanPath = rawPath || '';

  if (cleanPath === 'login' && event.httpMethod === 'POST') {
    const form = parseForm(event);
    if (checkPassword(form.get('password'))) {
      return redirect('/.netlify/functions/admin', { 'Set-Cookie': makeCookie() });
    }
    return loginPage('Wrong password.');
  }

  if (cleanPath === 'logout') {
    return redirect('/.netlify/functions/admin', { 'Set-Cookie': clearCookie() });
  }

  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return loginPage('Admin is not configured yet. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Netlify.');
  }

  if (cleanPath === 'login') {
    return isAuthed(event) ? redirect('/.netlify/functions/admin') : loginPage();
  }

  if (!isAuthed(event)) return loginPage();
  if (!cleanPath) return homePage();
  return serveFile(cleanPath);
};
