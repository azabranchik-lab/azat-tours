// Renders the guides grid (#guidesGrid) from window.GUIDES, with per-guide
// testimonials pulled from window.REVIEWS (placement "guide:<id>").
(function () {
  const G = window.GUIDES || [];
  const R = window.REVIEWS || [];
  const grid = document.getElementById('guidesGrid');
  if (!grid) return;
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const stars = n => '★★★★★'.slice(0, Math.max(1, Math.min(5, n || 5)));

  grid.innerHTML = G.map(g => {
    const langs = (g.languages || []).join(' · ');
    const grevs = R.filter(r => r.placement === 'guide:' + g.id).slice(0, 1);
    const grevHtml = grevs.length ? `<div class="guide-reviews">${grevs.map(r => `
        <div class="grev"><span class="stars">${stars(r.rating)}</span>
        <p>"${esc(r.text)}"</p><span class="grev-who">— ${esc(r.name)}${r.country ? ', ' + esc(r.country) : ''}</span></div>`).join('')}</div>` : '';
    return `<div class="member reveal in">
        <div class="ph"><img loading="lazy" src="${g.photo}" alt="${esc(g.name)}">${langs ? `<span class="lang">${esc(langs)}</span>` : ''}</div>
        <h3>${esc(g.name)}</h3><div class="role">${esc(g.role)}</div><p>${esc(g.bio)}</p>${grevHtml}
      </div>`;
  }).join('');
})();
