/* global location, sessionStorage */
// Runs before first paint (kept external because the CSP blocks inline scripts).
// Decides how the loading screen behaves and applies the saved colour theme early, so there is no flash.
(function () {
  var root = document.documentElement;
  var mode = 'full';
  try {
    if (localStorage.getItem('crowd-theme') === 'dark') root.setAttribute('data-theme', 'dark');
    sessionStorage.removeItem('crowd-splash');
    var forced = /[?&]splash(=|&|$)/.test(location.search);
    if (!forced) {
      if (navigator.webdriver) mode = 'off';
      // Table QR visitors want the menu fast: a short version only.
      else if (/[?&]table=/.test(location.search)) mode = 'quick';
    }
  } catch {
    /* storage can be blocked: keep the default */
  }
  root.setAttribute('data-splash', mode);
})();
