// Renders reviews from window.REVIEWS into the home carousel (#revTrack)
// and the reviews page masonry (#reviewsMasonry). Placement-aware.
(function () {
  const R = window.REVIEWS || [];
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const stars = n => '★★★★★'.slice(0, Math.max(1, Math.min(5, n || 5)));
  function card(r) {
    const sub = [r.country, r.context].filter(Boolean).join(' · ');
    return `<div class="review"><div class="stars">${stars(r.rating)}</div><p>"${esc(r.text)}"</p>
      <div class="who"><img loading="lazy" src="${r.avatar}" alt="${esc(r.name)}"><div><b>${esc(r.name)}</b><span>${esc(sub)}</span></div></div></div>`;
  }
  const track = document.getElementById('revTrack');
  if (track) {
    const home = R.filter(r => r.placement === 'home');
    if (home.length) track.innerHTML = home.map(card).join('');
    else { const sec = track.closest('section'); if (sec) sec.style.display = 'none'; } // hide until real reviews exist
  }
  const masonry = document.getElementById('reviewsMasonry');
  if (masonry) masonry.innerHTML = R.filter(r => r.placement === 'home' || r.placement === 'reviews').map(card).join('');
})();
