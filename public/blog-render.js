// Renders the blog index from window.POSTS (posts-data.js).
(function () {
  const POSTS = (window.POSTS || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rt = body => Math.max(1, Math.round(String(body).trim().split(/\s+/).length / 200)) + ' min';
  const dateStr = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const link = p => `post.html?slug=${encodeURIComponent(p.slug)}`;

  const featEl = document.getElementById('blogFeatured');
  const gridEl = document.getElementById('blogGrid');
  if (!gridEl) return;

  function featured(p) {
    return `<a href="${link(p)}" class="blog-feature reveal in" style="cursor:pointer">
      <div class="img"><img src="${p.cover}" alt="${esc(p.title)}"></div>
      <div class="body">
        <div class="post-meta"><span class="tag">${esc(p.category)}</span><span>${dateStr(p.date)} · ${rt(p.body)} read</span></div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.excerpt)}</p>
        <span class="btn btn-dark" style="align-self:flex-start">Read the guide</span>
      </div></a>`;
  }
  function card(p) {
    return `<a href="${link(p)}" class="post reveal in" data-cat="${esc(p.category)}">
      <div class="img"><img loading="lazy" src="${p.cover}" alt="${esc(p.title)}"></div>
      <div class="body"><div class="post-meta"><span class="tag">${esc(p.category)}</span><span>${rt(p.body)}</span></div>
      <h3>${esc(p.title)}</h3><span class="more">Read more</span></div></a>`;
  }

  if (!POSTS.length) { gridEl.innerHTML = '<p>No articles yet.</p>'; return; }

  const [first, ...rest] = POSTS;
  if (featEl) featEl.innerHTML = featured(first);
  gridEl.innerHTML = rest.map(card).join('');

  // category chips
  const cats = [...new Set(POSTS.map(p => p.category))];
  const bar = document.getElementById('blogCats');
  if (bar && cats.length > 1) {
    bar.innerHTML = `<button class="chip active" data-c="all">All</button>` +
      cats.map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)}</button>`).join('');
    bar.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => {
        bar.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        chip.classList.add('active');
        const c = chip.dataset.c;
        // featured follows filter too
        const shown = c === 'all' ? POSTS : POSTS.filter(p => p.category === c);
        if (featEl) featEl.innerHTML = shown.length ? featured(shown[0]) : '';
        gridEl.innerHTML = (c === 'all' ? rest : shown.slice(1)).map(card).join('');
      };
    });
  }
})();
