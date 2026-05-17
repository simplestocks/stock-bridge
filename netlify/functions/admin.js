const fs = require('fs');
const path = require('path');
const { checkPassword, clearCookie, isAuthed, makeCookie } = require('./admin-auth');

const ROOT = process.cwd();
const WORKER_STATUS_FILE = path.join(ROOT, 'netlify', 'worker-status.json');

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
  'feed-doctor.html': 'public/squarespace-posts/feed-doctor.html',
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
  <form method="post" action="/admin/login">
    <h1>SimpleStocks Admin</h1>
    <p>Private tools are locked. Enter the admin password.</p>
    <input name="password" type="password" autocomplete="current-password" autofocus>
    <button type="submit">Enter</button>
    <div class="err">${escapeHtml(message)}</div>
  </form>
</body>
</html>`);
}

function readWorkerStatuses() {
  try {
    return JSON.parse(fs.readFileSync(WORKER_STATUS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
}

function renderWorkerStatusCards(statuses) {
  if (!Array.isArray(statuses) || !statuses.length) {
    return '<div class="status-empty">No worker status yet.</div>';
  }

  return statuses.map((row) => `<article class="worker-card">
          <div class="worker-top">
            <strong>${escapeHtml(row.worker)}</strong>
            <span>${escapeHtml(row.status)}</span>
          </div>
          <p>${escapeHtml(row.project)}</p>
          <small>${escapeHtml(row.nextStep || row.task || row.waitingOn)}</small>
        </article>`).join('');
}

function homePage() {
  const workerStatusCards = renderWorkerStatusCards(readWorkerStatuses());
  return html(200, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SimpleStocks Admin</title>
  <style>
    :root { color-scheme: dark; --line:#253247; --panel:rgba(12,19,31,.74); --text:#e8eef8; --muted:#91a1b8; --nav-w:124px; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:linear-gradient(rgba(5,8,13,.76), rgba(5,8,13,.86)), url('/assets/ratrod.jpg') center/cover fixed; color:var(--text); font-family:Arial,Helvetica,sans-serif; padding:20px; }
    main { max-width:1160px; margin:0 auto; }
    a, button { font:inherit; }
    a { color:inherit; text-decoration:none; }
    .top { margin-bottom:18px; }
    header { display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:38px; }
    .brand { display:flex; align-items:center; gap:8px; text-transform:uppercase; flex-wrap:wrap; }
    .logo { font-size:15px; font-weight:900; letter-spacing:.08em; }
    .tagline { color:#6fffd2; font-size:13px; font-weight:800; letter-spacing:.1em; }
    .utility-btn { display:inline-flex; align-items:center; justify-content:center; min-height:28px; padding:6px 9px; border-radius:6px; border:1px solid rgba(255,91,91,.62); background:linear-gradient(135deg,#ff4b4b 0%,#b90000 100%); color:#fff; font-size:10px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; box-shadow:inset 1px 1px 1px rgba(255,255,255,.2), inset -2px -2px 5px rgba(0,0,0,.28), 0 5px 14px rgba(0,0,0,.28); }
    .utility-btn:hover { opacity:.86; }
    .logout { border:1px solid #49313a; border-radius:6px; color:#ffb0b0; padding:8px 11px; font-size:12px; font-weight:800; text-transform:uppercase; }
    .launcher-grid { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
    .nav-btn { display:inline-flex; align-items:center; justify-content:center; width:var(--nav-w); min-width:var(--nav-w); min-height:38px; padding:9px 8px; border-radius:6px; font-size:12px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; border:1px solid transparent; box-shadow:inset 1px 1px 1px rgba(255,255,255,.16), inset -2px -2px 5px rgba(0,0,0,.28), 0 5px 15px rgba(0,0,0,.26); transition:opacity .15s, transform .1s; text-align:center; white-space:nowrap; }
    .nav-btn:hover { opacity:.84; transform:translateY(-1px); }
    .magix-btn { background:linear-gradient(135deg,#00c8ff 0%,#0070f3 100%); border-color:#0070f3; color:#fff; box-shadow:0 0 10px rgba(0,112,243,.45); }
    .odte-btn { background:linear-gradient(135deg,#b7ff00 0%,#63d600 100%); border-color:#9cff00; color:#041000; box-shadow:0 0 10px rgba(156,255,0,.42); }
    .helo-btn { background:linear-gradient(135deg,#a855f7 0%,#7c3aed 100%); border-color:#7c3aed; color:#fff; box-shadow:0 0 10px rgba(124,58,237,.45); }
    .old-btn { background:linear-gradient(135deg,#555 0%,#2a2a2a 100%); border-color:#444; color:#c9c9c9; }
    .earnings-btn { background:linear-gradient(135deg,#ff8c00 0%,#cc6600 100%); border-color:#cc6600; color:#fff; box-shadow:0 0 10px rgba(255,140,0,.4); }
    .viewer-btn { background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); border-color:#6366f1; color:#fff; box-shadow:0 0 8px rgba(99,102,241,.42); }
    .tos-btn { background:linear-gradient(135deg,#d29922 0%,#b7791f 100%); border-color:#d29922; color:#050505; box-shadow:0 0 8px rgba(210,153,34,.35); }
    .writer-btn { background:linear-gradient(135deg,#38d39f 0%,#119c74 100%); border-color:#21b889; color:#04120e; }
    .event-btn { background:linear-gradient(135deg,#ffd166 0%,#f59e0b 100%); border-color:#f59e0b; color:#211000; }
    .todo-btn { background:linear-gradient(135deg,#f8fafc 0%,#cbd5e1 100%); border-color:#e2e8f0; color:#101827; }
    .status-panel, .intake-panel, .todo-panel { border:1px solid rgba(92,112,143,.52); border-radius:8px; background:var(--panel); box-shadow:inset 2px 2px 8px rgba(0,0,0,.58), inset -1px -1px 0 rgba(255,255,255,.08), 0 1px 0 rgba(255,255,255,.04); }
    .status-panel { padding:14px; min-height:320px; }
    .panel-title { margin:0 0 10px; color:#aab8ca; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
    .worker-list { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:10px; max-height:520px; overflow:auto; }
    .worker-card { border:1px solid rgba(55,76,111,.9); border-radius:7px; background:rgba(8,14,25,.88); padding:9px; box-shadow:inset 1px 1px 4px rgba(0,0,0,.48), inset -1px -1px 0 rgba(255,255,255,.05); }
    .worker-top { display:flex; justify-content:space-between; gap:8px; align-items:center; }
    .worker-top strong { font-size:13px; }
    .worker-top span { border:1px solid #2f8f6c; border-radius:99px; color:#77ffc9; padding:2px 7px; font-size:10px; font-weight:900; text-transform:uppercase; }
    .worker-card p { margin:5px 0 4px; color:#d6e2f1; font-size:12px; font-weight:800; }
    .worker-card small, .status-empty { color:var(--muted); font-size:11px; line-height:1.35; }
    .below { display:block; }
    .intake-panel { display:grid; grid-template-columns:120px 1fr 132px; gap:10px; align-items:start; padding:12px; margin-top:14px; }
    .intake-panel .panel-title { margin:3px 0 0; }
    textarea { width:100%; min-height:138px; resize:vertical; border:1px solid #31405a; border-radius:7px; background:rgba(6,11,19,.92); color:#e8eef8; padding:9px 10px; font:12px/1.35 Arial,Helvetica,sans-serif; box-shadow:inset 2px 2px 7px rgba(0,0,0,.62), inset -1px -1px 0 rgba(255,255,255,.06); }
    .copy-btn { width:100%; min-height:36px; border:0; border-radius:6px; background:#4ea1ff; color:#06101f; cursor:pointer; font-size:12px; font-weight:900; text-transform:uppercase; box-shadow:inset 1px 1px 1px rgba(255,255,255,.22), inset -2px -2px 5px rgba(0,0,0,.18); }
    .todo-panel { margin:12px 0 16px; padding:10px 12px; }
    .todo-panel summary { cursor:pointer; color:#dbe7f6; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; list-style:none; }
    .todo-panel summary::-webkit-details-marker { display:none; }
    .todo-panel[open] summary { margin-bottom:8px; }
    .todo-panel p { margin:0 0 9px; color:var(--muted); font-size:12px; line-height:1.35; }
    .todo-open { display:inline-flex; align-items:center; justify-content:center; min-height:32px; padding:7px 12px; border-radius:6px; background:linear-gradient(135deg,#f8fafc 0%,#cbd5e1 100%); border:1px solid #e2e8f0; color:#101827; font-size:11px; font-weight:900; text-transform:uppercase; box-shadow:inset 1px 1px 1px rgba(255,255,255,.38), inset -2px -2px 5px rgba(0,0,0,.2); }
    @media (max-width: 860px) {
      body { padding:14px; }
      header { align-items:flex-start; }
      .intake-panel { grid-template-columns:1fr; }
      .intake-panel .panel-title { margin:0; }
      .copy-btn { max-width:180px; }
    }
    @media (max-width: 520px) {
      .launcher-grid { display:grid; grid-template-columns:1fr 1fr; }
      .nav-btn { width:100%; min-width:0; padding-left:8px; padding-right:8px; letter-spacing:.04em; }
      .worker-list { grid-template-columns:1fr; }
      .copy-btn { max-width:none; }
    }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <header>
          <div class="brand">
            <div class="logo">SIMPLESTOCKS</div>
            <div class="tagline">// cockpit</div>
            <a class="utility-btn" href="/admin/feed-doctor.html">Site Feed Doctor</a>
          </div>
          <a class="logout" href="/admin/logout">Log out</a>
        </header>
        <nav class="launcher-grid" aria-label="Admin destinations">
          <a class="nav-btn magix-btn" href="https://magix-production.up.railway.app/" target="_blank" rel="noreferrer">Magix</a>
          <a class="nav-btn odte-btn" href="/admin/odte-dashboard.html">SPX 0DTE</a>
          <a class="nav-btn helo-btn" href="/admin/command-center.html">HELO</a>
          <a class="nav-btn old-btn" href="https://magix-production.up.railway.app/" target="_blank" rel="noreferrer">Old 0DTE</a>
          <a class="nav-btn earnings-btn" href="/admin/alerts.html">Earns</a>
          <a class="nav-btn viewer-btn" href="https://magix-production.up.railway.app/viewer.html" target="_blank" rel="noreferrer">Viewer</a>
          <a class="nav-btn tos-btn" href="https://magix-production.up.railway.app/auth/tos" target="_blank" rel="noreferrer">Auth TOS</a>
          <a class="nav-btn writer-btn" href="/admin/writer.html">Writer</a>
          <a class="nav-btn event-btn" href="https://script.google.com/macros/s/AKfycbzap3pKAGdBirffsG5BbSqhkfbdd_kUInpyFVKidrBTr-Kk-n34NYc4jMR3qr-MrV5z/exec" target="_blank" rel="noreferrer">Events</a>
          <a class="nav-btn todo-btn" href="https://nic-todo.netlify.app" target="_blank" rel="noreferrer">Todo</a>
        </nav>
        <section class="intake-panel">
          <h2 class="panel-title">Codex Intake</h2>
          <textarea id="codexPrompt">Work in C:\\FUCKYOUCHATGPT\\stock-bridge-push-work.
Task:
Ownership:
Checks:
No commit, no push.</textarea>
          <button class="copy-btn" type="button" onclick="navigator.clipboard.writeText(document.getElementById('codexPrompt').value); this.textContent='Copied'; setTimeout(()=>this.textContent='Copy Prompt',1200);">Copy Prompt</button>
        </section>
        <details class="todo-panel">
          <summary>Todo</summary>
          <p>Todo blocks iframe embedding. Open the live app directly.</p>
          <a class="todo-open" href="https://nic-todo.netlify.app" target="_blank" rel="noreferrer">Open Todo</a>
        </details>
      </div>
    </div>
    <div class="below">
      <section class="status-panel">
        <h2 class="panel-title">Worker Status</h2>
        <div class="worker-list">
          ${workerStatusCards}
        </div>
      </section>
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
    body = body.replaceAll('./styles.css', '/admin/styles.css')
      .replaceAll('./widget.js', '/admin/widget.js')
      .replaceAll('./posts.json', '/.netlify/functions/member-feed')
      .replaceAll('./feed.xml', '/.netlify/functions/member-feed')
      .replaceAll('./index.html', '/admin/index.html')
      .replaceAll('./writer.html', '/admin/writer.html');
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
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/command-center.html', '/admin/command-center.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/command-center', '/admin/command-center.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/odte-dashboard.html', '/admin/odte-dashboard.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/alerts.html', '/admin/alerts.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/squarespace-posts/writer.html', '/admin/writer.html')
    .replaceAll('https://jazzy-starlight-0a9a95.netlify.app/squarespace-posts/index.html', '/admin/index.html');
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
<a class="ss-admin-back" href="/admin/">Admin</a>`;
  if (body.includes('</body>')) return body.replace('</body>', `${bar}</body>`);
  return `${bar}${body}`;
}

function cleanPathFromEvent(event) {
  const queryPath = String(event.queryStringParameters?.path || '').replace(/^\/+/, '');
  if (queryPath) return queryPath;

  const eventPath = String(event.path || '').replace(/^\/+/, '');
  if (eventPath === 'admin') return '';
  if (eventPath.startsWith('admin/')) return eventPath.slice('admin/'.length).replace(/^\/+/, '');
  return '';
}

exports.handler = async function(event) {
  const cleanPath = cleanPathFromEvent(event);

  if (cleanPath === 'login' && event.httpMethod === 'POST') {
    const form = parseForm(event);
    if (checkPassword(form.get('password'))) {
      return redirect('/admin/', { 'Set-Cookie': makeCookie() });
    }
    return loginPage('Wrong password.');
  }

  if (cleanPath === 'logout') {
    return redirect('/admin/', { 'Set-Cookie': clearCookie() });
  }

  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return loginPage('Admin is not configured yet. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Netlify.');
  }

  if (cleanPath === 'login') {
    return isAuthed(event) ? homePage() : loginPage();
  }

  if (!isAuthed(event)) return loginPage();
  if (!cleanPath) return homePage();
  return serveFile(cleanPath);
};
