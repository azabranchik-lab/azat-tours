// ---------- header scroll state ----------
const header = document.getElementById('header');
if (header && !header.classList.contains('solid')) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ---------- reveal on scroll ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
window.addEventListener('load', () => {
  document.querySelectorAll('.hero .reveal, .page-hero .reveal').forEach(el => el.classList.add('in'));
});

// ---------- mobile menu ----------
const mm = document.getElementById('mobileMenu');
const burger = document.getElementById('burger');
if (burger && mm) {
  burger.onclick = () => mm.classList.add('open');
  document.getElementById('closeMenu').onclick = () => mm.classList.remove('open');
  document.querySelectorAll('[data-close]').forEach(a => a.onclick = () => mm.classList.remove('open'));
}

// ---------- FAQ accordion ----------
document.querySelectorAll('.faq-q').forEach(q => {
  q.onclick = () => {
    const item = q.parentElement;
    const a = item.querySelector('.faq-a');
    const open = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => { i.classList.remove('open'); i.querySelector('.faq-a').style.maxHeight = null; });
    if (!open) { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
  };
});
const firstFaq = document.querySelector('.faq-item.open .faq-a');
if (firstFaq) firstFaq.style.maxHeight = firstFaq.scrollHeight + 'px';

// ---------- reviews carousel ----------
const track = document.getElementById('revTrack');
if (track) {
  const card = () => track.querySelector('.review').offsetWidth + 24;
  const next = document.getElementById('revNext');
  const prev = document.getElementById('revPrev');
  if (next) next.onclick = () => track.scrollBy({ left: card(), behavior: 'smooth' });
  if (prev) prev.onclick = () => track.scrollBy({ left: -card(), behavior: 'smooth' });
}

// ============================================================
//  LEAD FORM
//  Submissions are sent by email via Web3Forms (free, no server).
//  → Get a free access key at https://web3forms.com (just enter
//    the email where you want to receive enquiries), then paste it
//    below. Until then the form runs in DEMO mode (shows the thank-you
//    screen without sending anything).
// ============================================================
const WEB3FORMS_KEY = "b8d4fb62-00dc-4e7f-ab17-3f8c8b5aeced";

const leadForm = document.getElementById('leadForm');
if (leadForm) {
  const success = document.getElementById('formSuccess');
  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = leadForm.querySelector('button[type="submit"]');

    // DEMO mode, no key configured yet
    if (!WEB3FORMS_KEY || WEB3FORMS_KEY.startsWith('YOUR-')) {
      leadForm.style.display = 'none';
      success.classList.add('show');
      return;
    }

    const original = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const data = Object.fromEntries(new FormData(leadForm).entries());

    try {
      const res = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (json.ok) {
        leadForm.style.display = 'none';
        success.classList.add('show');
      } else {
        throw new Error('Submission failed');
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
      alert('Sorry, something went wrong sending your request. Please message us on WhatsApp instead.');
    }
  });
}

// ---------- gallery lightbox (generic: any .gallery) ----------
(function () {
  const galleries = document.querySelectorAll('.gallery');
  if (!galleries.length) return;
  let lb, imgEl, countEl, imgs = [], idx = 0;

  function build() {
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<button class="lb-close" aria-label="Close">&times;</button>' +
      '<button class="lb-prev" aria-label="Previous">&#8249;</button>' +
      '<img class="lb-img" alt="">' +
      '<button class="lb-next" aria-label="Next">&#8250;</button>' +
      '<div class="lb-count"></div>';
    document.body.appendChild(lb);
    imgEl = lb.querySelector('.lb-img');
    countEl = lb.querySelector('.lb-count');
    lb.querySelector('.lb-close').onclick = close;
    lb.querySelector('.lb-prev').onclick = () => show(idx - 1);
    lb.querySelector('.lb-next').onclick = () => show(idx + 1);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
  }
  function show(i) {
    idx = (i + imgs.length) % imgs.length;
    imgEl.src = imgs[idx];
    countEl.textContent = (idx + 1) + ' / ' + imgs.length;
  }
  function open(list, i) {
    if (!lb) build();
    imgs = list;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    show(i);
  }
  function close() {
    if (!lb) return;
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }
  galleries.forEach(g => {
    const anchors = [...g.querySelectorAll('a')];
    const list = anchors.map(a => a.getAttribute('href')).filter(Boolean);
    anchors.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); open(list, i); }));
  });
  document.addEventListener('keydown', e => {
    if (!lb || !lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
  });
})();

// ---------- tour filters ----------
const chips = document.querySelectorAll('.chip');
if (chips.length) {
  const tours = document.querySelectorAll('.tours-grid .tour');
  const noResult = document.querySelector('.no-result');
  chips.forEach(chip => {
    chip.onclick = () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.dataset.filter;
      let shown = 0;
      tours.forEach(t => {
        const match = cat === 'all' || t.dataset.cat.split(' ').includes(cat);
        t.classList.toggle('hide', !match);
        if (match) shown++;
      });
      if (noResult) noResult.classList.toggle('show', shown === 0);
    };
  });
}
