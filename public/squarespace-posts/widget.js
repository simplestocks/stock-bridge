(function () {
  const root = document.getElementById('ss-post-feed');
  if (!root) return;

  const scriptUrl = document.currentScript && document.currentScript.src ? document.currentScript.src : 'https://jazzy-starlight-0a9a95.netlify.app/squarespace-posts/widget.js';
  const feedUrl = new URL(root.getAttribute('data-feed') || '/.netlify/functions/member-feed', scriptUrl).toString();
  const ticketUrl = new URL(root.getAttribute('data-ticket') || '/.netlify/functions/member-feed-ticket', scriptUrl).toString();
  const refreshMs = Number(root.getAttribute('data-refresh-ms') || 30000);
  const state = { posts: [], query: '', tag: 'all', lane: 'all' };

  root.innerHTML = [
    '<div class="ss-feed-shell">',
    '  <div class="ss-feed-toolbar">',
    '    <input class="ss-feed-search" type="search" placeholder="Search posts, tickers, tags..." />',
    '    <select class="ss-feed-tags"><option value="all">All tags</option></select>',
    '  </div>',
    '  <div class="ss-feed-status">Loading posts...</div>',
    '  <div class="ss-feed-list"></div>',
    '</div>'
  ].join('');

  const search = root.querySelector('.ss-feed-search');
  const tagSelect = root.querySelector('.ss-feed-tags');
  const status = root.querySelector('.ss-feed-status');
  const list = root.querySelector('.ss-feed-list');

  search.addEventListener('input', () => {
    state.query = search.value.trim().toLowerCase();
    render();
  });

  tagSelect.addEventListener('change', () => {
    state.tag = tagSelect.value;
    render();
  });

  setupExternalNavControls();
  loadFeed();
  if (refreshMs >= 5000) {
    window.setInterval(() => loadFeed(true), refreshMs);
  }

  async function loadFeed(isRefresh) {
    try {
      const ticket = await getTicket();
      const res = await fetch(withParams(feedUrl, { token: ticket, t: Date.now() }), { cache: 'no-store' });
      if (!res.ok) throw new Error('Feed failed: ' + res.status);
      const posts = await res.json();
      const nextPosts = posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      const nextSignature = nextPosts.map((post) => post.id + ':' + post.date).join('|');
      const currentSignature = state.posts.map((post) => post.id + ':' + post.date).join('|');
      if (isRefresh && nextSignature === currentSignature) return;
      state.posts = nextPosts;
      hydrateTags();
      render();
    } catch (err) {
      if (!isRefresh) status.textContent = 'Could not load posts: ' + err.message;
    }
  }

  async function getTicket() {
    const res = await fetch(withParams(ticketUrl, { t: Date.now() }), { cache: 'no-store' });
    if (!res.ok) throw new Error('Ticket failed: ' + res.status);
    const json = await res.json();
    if (!json.token) throw new Error('Ticket missing');
    return json.token;
  }

  function hydrateTags() {
    const tags = Array.from(new Set(state.posts.flatMap((post) => post.tags || []))).sort();
    tagSelect.innerHTML = '<option value="all">All tags</option>' + tags.map((tag) => (
      '<option value="' + escapeAttr(tag) + '">' + escapeHtml(tag) + '</option>'
    )).join('');
  }

  function render() {
    const terms = searchTerms(state.query);
    const filtered = state.posts.filter((post) => {
      const haystack = normalizeSearch([post.title, post.summary, post.body, post.type, post.author, ...(post.tags || [])].join(' '));
      const queryOk = !terms.length || terms.every((term) => haystack.includes(term));
      const tagOk = state.tag === 'all' || (post.tags || []).includes(state.tag);
      const laneOk = state.lane === 'all' || postLane(post) === state.lane;
      return queryOk && tagOk && laneOk;
    });

    status.textContent = filtered.length + ' post' + (filtered.length === 1 ? '' : 's');
    list.innerHTML = filtered.map(renderPost).join('') || '<div class="ss-feed-empty">No matching posts.</div>';
  }

  function renderPost(post) {
    const date = new Date(post.date);
    const dateText = date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    const tags = (post.tags || []).map((tag) => '<span class="ss-feed-tag">' + escapeHtml(tag) + '</span>').join('');
    const type = post.type || 'post';
    const lane = postLane(post);
    return [
      '<article class="ss-feed-post ss-feed-' + escapeAttr(type) + '" data-type="' + escapeAttr(type) + '" data-feed-lane="' + escapeAttr(lane) + '" id="' + escapeAttr(post.id) + '">',
      '  <div class="ss-feed-meta">' + escapeHtml(dateText) + ' / ' + escapeHtml(typeLabel(type)) + '</div>',
      '  <h3>' + escapeHtml(post.title) + '</h3>',
      '  <p class="ss-feed-summary">' + escapeHtml(post.summary || '') + '</p>',
      '  <div class="ss-feed-body">' + renderRichText(post.body || '') + '</div>',
      '  <div class="ss-feed-tagrow">' + tags + '</div>',
      '</article>'
    ].join('');
  }

  function renderRichText(value) {
    const lines = String(value || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let bullets = [];

    function flushBullets() {
      if (!bullets.length) return;
      out.push('<ul>' + bullets.map((line) => '<li>' + inlineFormat(line) + '</li>').join('') + '</ul>');
      bullets = [];
    }

    lines.forEach((raw) => {
      const line = raw.trim();
      if (!line) {
        flushBullets();
        return;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        bullets.push(line.slice(2).trim());
        return;
      }
      flushBullets();
      if (line.startsWith('### ')) {
        out.push('<h4>' + inlineFormat(line.slice(4)) + '</h4>');
      } else if (line.startsWith('## ')) {
        out.push('<h4>' + inlineFormat(line.slice(3)) + '</h4>');
      } else if (line.startsWith('! ')) {
        out.push('<div class="ss-feed-callout">' + inlineFormat(line.slice(2)) + '</div>');
      } else if (line.startsWith('> ')) {
        out.push('<blockquote>' + inlineFormat(line.slice(2)) + '</blockquote>');
      } else {
        out.push('<p>' + inlineFormat(line) + '</p>');
      }
    });
    flushBullets();
    return out.join('');
  }

  function inlineFormat(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\b([A-Z]{1,5})(?=\b)/g, '<span class="ss-feed-ticker">$1</span>');
  }

  function typeLabel(type) {
    const labels = {
      alert: 'Alert',
      'new-trade': 'New Trade',
      'trade-update': 'Trade Update',
      update: 'Market Update',
      education: 'Education',
      event: 'Event',
      'member-note': 'Event'
    };
    return labels[type] || type;
  }

  function postLane(post) {
    const type = String(post.type || '').toLowerCase();
    if (['new-trade', 'trade-update', 'trade', 'trades'].includes(type)) return 'trades';
    return 'updates';
  }

  function setupExternalNavControls() {
    [
      ['btn-all', 'all'],
      ['btn-trades', 'trades'],
      ['btn-updates', 'updates']
    ].forEach(([id, lane]) => {
      const button = document.getElementById(id);
      if (!button || button.dataset.ssFeedBound === '1') return;
      button.dataset.ssFeedBound = '1';
      button.addEventListener('click', () => {
        state.lane = lane;
        updateExternalNavControls();
        render();
      });
    });
  }

  function updateExternalNavControls() {
    [
      ['btn-all', 'all'],
      ['btn-trades', 'trades'],
      ['btn-updates', 'updates']
    ].forEach(([id, lane]) => {
      const button = document.getElementById(id);
      if (button) button.classList.toggle('nav-active', state.lane === lane);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/\s+/g, '-');
  }

  function searchTerms(query) {
    return normalizeSearch(query)
      .split(' ')
      .filter(Boolean)
      .filter((term) => !['and', 'or', 'the', 'a', 'an'].includes(term));
  }

  function normalizeSearch(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/\bnvidia\b/g, 'nvda')
      .replace(/[^a-z0-9$.\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function withParams(url, params) {
    const next = new URL(url, window.location.href);
    Object.keys(params).forEach((key) => next.searchParams.set(key, params[key]));
    return next.toString();
  }
})();
