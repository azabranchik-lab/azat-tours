// Blog index behaviour. The server sends the full list in the HTML (lib/pages.js);
// this script adds the category chips and re-renders the list when one is picked.
(function () {
  const POSTS = (window.POSTS || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const { esc, postFeatured: featured, postCard: card } = window.Cards;   // shared with the server render (cards.js)

  const featEl = document.getElementById('blogFeatured');
  const gridEl = document.getElementById('blogGrid');
  if (!gridEl) return;

  if (!POSTS.length) { if (!gridEl.children.length) gridEl.innerHTML = '<p>No articles yet.</p>'; return; }

  const [first, ...rest] = POSTS;
  if (!gridEl.children.length) {   // only fill an empty page; normally the list is already there
    if (featEl) featEl.innerHTML = featured(first);
    gridEl.innerHTML = rest.map(card).join('');
  }

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
