/* Google Analytics 4 — loaded from every page's <head> (single place to change the ID).
   Skips localhost/127.0.0.1 so local previews don't pollute the property's data.
   The gtag script itself (~180 KB) is fetched only after the page has loaded and the browser
   is idle, or on the first interaction, whichever comes first: hits are queued in dataLayer
   meanwhile, so nothing is lost and the tag never competes with the page content. */
(function () {
  var GA_ID = 'G-78XP6Z3VJB';

  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || host.endsWith('.local');
  if (isLocal || !GA_ID || GA_ID.indexOf('G-X') === 0) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_ID);

  var loaded = false;
  function loadTag() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }
  function whenIdle() {
    if (window.requestIdleCallback) requestIdleCallback(loadTag, { timeout: 3000 });
    else setTimeout(loadTag, 1500);
  }
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle);
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, loadTag, { once: true, passive: true });
  });
})();
