/* Google Analytics 4 — loaded from every page's <head> (single place to change the ID).
   Skips localhost/127.0.0.1 so local previews don't pollute the property's data. */
(function () {
  var GA_ID = 'G-78XP6Z3VJB';

  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || host.endsWith('.local');
  if (isLocal || !GA_ID || GA_ID.indexOf('G-X') === 0) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_ID);

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);
})();
