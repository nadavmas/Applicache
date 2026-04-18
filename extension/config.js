/**
 * Must stay aligned with `externally_connectable.matches` in manifest.json
 * (scheme + host + port). Add your production SPA origin here and in the manifest when deploying.
 */
(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : self;
  if (!g) return;
  g.APPLICACHE_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    // "https://your-production-host.example",
  ];
  g.APPLICACHE_APP_ORIGIN = g.APPLICACHE_ALLOWED_ORIGINS[0];
  /**
   * REST API base URL — set in gitignored `env.local.js` (see `env.local.example.js`).
   * Must match VITE_API_URL in the frontend `.env.local`.
   */
  g.APPLICACHE_API_BASE_URL = "";
})();
