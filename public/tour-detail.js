// Behaviour for a tour page. The server renders the whole page (lib/tour-page.js);
// this script only binds the accordion, FAQ and tab interactions.
(function () {
  const root = document.getElementById('tourRoot') || document.getElementById('carRoot');   // car pages reuse the FAQ accordion
  if (!root) return;

  // floating WhatsApp button carries the tour-specific message (same link as the form's)
  const formWa = root.querySelector('.form-wa');
  if (formWa) document.querySelectorAll('[data-wa]').forEach(a => a.href = formWa.href);

  // itinerary accordion
  root.querySelectorAll('.tl-q').forEach(q => {
    q.onclick = () => {
      const item = q.parentElement, a = item.querySelector('.tl-a'), open = item.classList.contains('open');
      item.classList.toggle('open');
      a.style.maxHeight = open ? null : a.scrollHeight + 'px';
    };
  });
  const first = root.querySelector('.tl.open .tl-a');
  if (first) first.style.maxHeight = first.scrollHeight + 'px';

  // Tour FAQ accordion: bound HERE (own .tfaq-q class), NOT via script.js's shared
  // .faq-q handler. That handler set an inline max-height from scrollHeight, which
  // on this page computed to 0 and kept the answer collapsed. Open state is
  // pure CSS (.faq-item.open, styles.css), so this only toggles the class — reliable,
  // no scrollHeight timing. Single-open accordion, all start closed.
  root.querySelectorAll('.tfaq-q').forEach(q => {
    q.onclick = () => {
      const item = q.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      root.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-a').style.maxHeight = '';   // back to CSS max-height:0
      });
      // Open with max-height:none (a plain length here can compute to 0 in some engines);
      // the CSS overflow clip is lifted so the full answer shows.
      if (!wasOpen) { item.classList.add('open'); item.querySelector('.faq-a').style.maxHeight = 'none'; }
    };
  });

  // about-this-tour tabs
  root.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      const id = tab.dataset.tab;
      root.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === tab));
      root.querySelectorAll('.tabpanel').forEach(p => p.classList.toggle('open', p.dataset.panel === id));
    };
  });
})();
