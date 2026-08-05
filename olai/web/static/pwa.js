// PWA glue: register the service worker, and keep <meta name=theme-color>
// in step with the theme the page is actually in.
//
// theme-color is the browser chrome (status bar, installed-app title bar).
// The sheet paints --paper; we read it after the first paint and whenever a
// pref chip flips. prefs.js does not know about meta tags, and this file
// does not know about localStorage — one job each.
(function () {
  if ('serviceWorker' in navigator) {
    // register after load so it does not race first paint / htmx
    window.addEventListener('load', function () {
      // /sw.js, not /static/sw.js: a worker's default scope is its directory,
      // and the app is the whole origin. serve.rkt owns that URL.
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  function paper() {
    try {
      var v = getComputedStyle(document.documentElement)
        .getPropertyValue('--paper').trim();
      return v || null;
    } catch (e) { return null; }
  }

  function paintThemeColor() {
    var c = paper();
    if (!c) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', c);
  }

  // after the sheet lands (this script is defer), and after a theme chip
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintThemeColor);
  } else {
    paintThemeColor();
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.ol-pref-opt')) {
      // prefs.js writes data-theme first; let the cascade settle
      requestAnimationFrame(function () {
        requestAnimationFrame(paintThemeColor);
      });
    }
  });
})();
