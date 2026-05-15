(function () {
  const root = document.getElementById('ss-post-feed');
  if (!root) return;

  const feedUrl = root.getAttribute('data-feed') || 'posts.json';
  const state = { posts: [], query: '', tag: 'all' };

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

  fetch(feedUrl, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('Feed failed: ' + res.status);
      return res.json();
    })
    .then((posts) => {
      state.posts = posts.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      hydrateTags();
      render();
    })
    .catch((err) => {
      status.textContent = 'Could not load posts: ' + err.message;
    });

  function hydrateTags() {
    const tags = Array.from(new Set(state.posts.flatMap((post) => post.tags || []))).sort();
    tagSelect.innerHTML = '<option value="all">All tags</option>' + tags.map((tag) => (
      '<option value="' + escapeAttr(tag) + '">' + escapeHtml(tag) + '</option>'
    )).join('');
  }

  function render() {
    const filtered = state.posts.filter((post) => {
      const haystack = [post.title, post.summary, post.body, post.type, post.author, ...(post.tags || [])]
        .join(' ')
        .toLowerCase();
      const queryOk = !state.query || haystack.includes(state.query);
      const tagOk = state.tag === 'all' || (post.tags || []).includes(state.tag);
      return queryOk && tagOk;
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
    return [
      '<article class="ss-feed-post ss-feed-' + escapeAttr(post.type || 'post') + '" id="' + escapeAttr(post.id) + '">',
      '  <div class="ss-feed-meta">' + escapeHtml(dateText) + ' / ' + escapeHtml(post.type || 'post') + '</div>',
      '  <h3>' + escapeHtml(post.title) + '</h3>',
      '  <p class="ss-feed-summary">' + escapeHtml(post.summary || '') + '</p>',
      '  <p>' + escapeHtml(post.body || '') + '</p>',
      '  <div class="ss-feed-tagrow">' + tags + '</div>',
      '</article>'
    ].join('');
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
})();
