/**
 * Prefer generating the real file from the repo root:
 *   npm run sync-extension-env
 * That reads frontend/.env.local (VITE_API_URL) and writes gitignored env.local.js.
 *
 * Or copy this file to env.local.js and set APPLICACHE_API_BASE_URL by hand (no trailing slash).
 */
(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : self;
  if (!g) return;
  g.APPLICACHE_API_BASE_URL = "";
})();
