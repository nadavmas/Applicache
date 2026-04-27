/**
 * Dev vs prod: set `IS_DEV` to `true` for local Vite (`http://localhost:5173`).
 * Production dashboard / login links use `APPLICACHE_PROD_APP_ORIGIN`.
 *
 * Must stay aligned with `externally_connectable.matches` in manifest.json
 * (scheme + host + port).
 */
const IS_DEV = false;

/** Canonical production SPA (no trailing slash). */
const APPLICACHE_PROD_APP_ORIGIN = "https://appli-cache.vercel.app";

(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : self;
  if (!g) return;

  g.APPLICACHE_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://appli-cache.vercel.app",
    "https://applicache-git-main-nadavmas-projects.vercel.app",
  ];

  const prodOrigin = String(APPLICACHE_PROD_APP_ORIGIN).trim().replace(/\/+$/, "");
  g.APPLICACHE_APP_ORIGIN = IS_DEV
    ? "http://localhost:5173"
    : prodOrigin;

  /**
   * REST API base URL — set in gitignored `env.local.js` (see `env.local.example.js`).
   * Must match VITE_API_URL in the frontend `.env.local`.
   */
  g.APPLICACHE_API_BASE_URL = "";
})();
