// Shared header + mobile menu + footer + floating CTAs, built from ONE source.
// Per-page config via <body data-page="home|tours|tour|about|blog|post|contact|reviews|plan">.
// The server puts this markup into the HTML it sends (lib/pages.js requires this
// file), so the navigation links exist without JavaScript. In the browser the
// script only injects when the markup is not there yet (a page opened as a file).
// Must load BEFORE script.js (which binds #burger/#header/#mobileMenu synchronously).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else factory().mount();
})(typeof self !== 'undefined' ? self : this, function () {
 // opts.cars: true while at least one rental car is published (the server knows;
 // the browser fallback below has no data and simply leaves the link out).
 function render(page, opts) {
  if (!page) return null; // pages without data-page keep their own chrome
  var hasCars = !!(opts && opts.cars);

  var WA = 'https://wa.me/996502888001?text=Hi%20Azat%20Tours!%20I%27d%20like%20to%20plan%20a%20trip%20to%20Kyrgyzstan.';
  var THEME_BTN = '<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle light/dark theme" title="Light / dark"><svg class="moon" viewBox="0 0 24 24"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"/></svg><svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/></svg></button>';
  var WA_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.3.1.2.1.7-.1 1.4Z"/></svg>';

  // nav links: [activeKey, label, href]
  var NAV = [['tours', 'Tours', '/tours/'], ['about', 'About', '/about.html'], ['blog', 'Blog', '/blog/'], ['contact', 'Contact', '/contact.html'], ['plan', 'Plan your trip', '/plan-trip.html']];
  if (hasCars) NAV.splice(1, 0, ['cars', 'Car rental', '/cars/']);   /* owner decision 2026-10-16: right after Tours, only when a car is published */

  // per-page: which nav link is active, the CTA, header style
  var CFG = {
    home:       { active: '',        cta: ['Get a free quote', '#plan'],      solid: false },  /* label matches the #plan form heading; avoids duplicating the "Plan your trip" nav link */
    tours:      { active: 'tours',   cta: ['Plan your trip', '/plan-trip.html'], solid: true },
    about:      { active: 'about',   cta: ['Plan your trip', '/plan-trip.html'], solid: true },
    blog:       { active: 'blog',    cta: ['Plan your trip', '/plan-trip.html'], solid: true },
    post:       { active: 'blog',    cta: ['Plan your trip', '/plan-trip.html'], solid: true },
    contact:    { active: 'contact', cta: ['Plan your trip', '/plan-trip.html'], solid: true },
    reviews:    { active: '',        cta: ['Plan your trip', '/plan-trip.html'], solid: true },
    plan:       { active: 'plan',    cta: ['Build your trip', '/builder.html'], solid: true },  /* no self-link: plan page's CTA drives to the builder */
    tour:       { active: 'tours',   cta: ['Request this tour', '#book'],     solid: true },
    builder:    { active: '',        cta: null,                              solid: true },  /* the step flow has its own sticky Continue; a second primary here would compete */
    cars:       { active: 'cars',    cta: ['Plan your trip', '/plan-trip.html'], solid: true },
    car:        { active: 'cars',    cta: ['Request this car', '#book'],      solid: true },
  };
  var cfg = CFG[page] || CFG.tours;

  function navLinks(close) {
    return NAV.map(function (n) {
      var cls = n[0] === cfg.active ? ' class="active"' : '';
      return '<a href="' + n[2] + '"' + cls + (close ? ' data-close' : '') + '>' + n[1] + '</a>';
    }).join('');
  }

  var LOGO = '<a href="/" class="logo">' +
    '<span>Azat Tours<small>Kyrgyzstan</small></span></a>';

  var headerCta = cfg.cta ? '<a href="' + cfg.cta[1] + '" class="btn btn-primary nav-cta">' + cfg.cta[0] + '</a>' : '';

  var header =
    '<header id="header"' + (cfg.solid ? ' class="solid"' : '') + '>' +
      '<div class="wrap nav">' + LOGO +
        '<div class="nav-links">' + navLinks(false) + THEME_BTN + headerCta +
        '</div>' +
        '<button class="burger" id="burger" aria-label="Open menu"><span></span><span></span><span></span></button>' +
      '</div>' +
    '</header>';

  var mobile =
    '<div class="mobile-menu" id="mobileMenu">' +
      '<div class="top"><span class="logo" style="color:#fff">Azat Tours</span>' + THEME_BTN +
        '<button class="close" id="closeMenu" aria-label="Close menu">&times;</button></div>' +
      '<nav>' + navLinks(true) + '</nav>' +
      (cfg.cta ? '<a href="' + cfg.cta[1] + '" class="btn btn-primary" data-close>' + cfg.cta[0] + '</a>' : '') +
    '</div>';

  var footer =
    '<footer><div class="wrap foot-slim">' +
      '<div class="foot-brand">' +
        '<div class="logo">Azat Tours<small style="letter-spacing:.28em">Kyrgyzstan</small></div>' +
        '<p class="blurb">Azat means &ldquo;free&rdquo;. Small-group adventures in the Kyrgyz mountains, run by locals since 2019.</p>' +
      '</div>' +
      '<div class="foot-col"><p class="foot-h">Explore</p><ul>' +
        (hasCars ? '<li><a href="/cars/">Car rental</a></li>' : '') +
        '<li><a href="/about.html">About us</a></li>' +
        '<li><a href="/blog/">Blog</a></li>' +
        '<li><a href="/plan-trip.html">Plan your trip</a></li>' +
        '<li><a href="/contact.html">Contact</a></li>' +
      '</ul></div>' +
      '<div class="foot-col"><p class="foot-h">Contact</p><ul>' +
        '<li><a href="https://wa.me/996502888001" target="_blank" rel="noopener">WhatsApp</a></li>' +
        '<li><a href="mailto:{{CONTACT_EMAIL}}">{{CONTACT_EMAIL}}</a></li>' +
        '<li><a href="/contact.html">Bishkek, Kyrgyzstan</a></li>' +
      '</ul></div>' +
      '<div class="foot-bottom"><span>© 2026 Azat Tours, Bishkek, Kyrgyzstan.</span></div>' +
    '</div></footer>';

  var floatWa = '<a href="' + WA + '" target="_blank" rel="noopener" class="float-wa" data-wa aria-label="Chat on WhatsApp">' + WA_SVG + '</a>';
  /* mobile bottom bar (WhatsApp us / Tours) removed 2026-07-10 by owner decision — kino-panel hero redesign */

  return { top: header + mobile, bottom: footer + floatWa };
 }

 function mount() {
  var chrome = render((document.body && document.body.dataset.page) || '');
  if (!chrome || document.getElementById('header')) return;   // nothing to do, or already in the HTML
  document.body.insertAdjacentHTML('afterbegin', chrome.top);
  document.body.insertAdjacentHTML('beforeend', chrome.bottom);
 }

 return { render: render, mount: mount };
});
