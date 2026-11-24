// Hides the static loading screen from index.html once the app has mounted.
// The animation always plays to the end first, so it never cuts off half-way.
const minimum: Record<string, number> = { full: 2000, quick: 950 };
let started = false;
export function dismissLoader() {
  const loader = document.getElementById('crowd-loader');
  if (!loader || started) return;
  started = true;
  try {
    sessionStorage.removeItem('crowd-splash');
  } catch {
    /* ignore */
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const floor = reduced ? 0 : (minimum[document.documentElement.dataset.splash ?? ''] ?? 0);
  const wait = Math.max(0, floor - performance.now());
  const fonts = document.fonts?.ready ?? Promise.resolve();
  void Promise.race([fonts, new Promise((resolve) => window.setTimeout(resolve, 1500))]).then(() =>
    window.setTimeout(() => {
      loader.classList.add('gl-done');
      window.setTimeout(() => loader.remove(), 700);
    }, wait),
  );
}
