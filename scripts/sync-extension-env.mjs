/**
 * Reads VITE_API_URL from frontend/.env.local and writes extension/env.local.js
 * so the Chrome extension popup uses the same API base as the Vite app.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, "frontend", ".env.local");
const outPath = join(root, "extension", "env.local.js");

function parseViteApiUrl(contents) {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^VITE_API_URL\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\/$/, "");
    return v;
  }
  return null;
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Create it from frontend/.env.example and set VITE_API_URL.`);
  process.exit(1);
}

const raw = readFileSync(envPath, "utf8");
const url = parseViteApiUrl(raw);

if (!url) {
  console.error(`No VITE_API_URL found in ${envPath}`);
  process.exit(1);
}

const body = `/**
 * AUTO-GENERATED — do not edit by hand. Run: npm run sync-extension-env
 * Source: frontend/.env.local (VITE_API_URL)
 */
(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : self;
  if (!g) return;
  g.APPLICACHE_API_BASE_URL = ${JSON.stringify(url)};
})();
`;

writeFileSync(outPath, body, "utf8");
console.log(`Wrote ${outPath}`);
