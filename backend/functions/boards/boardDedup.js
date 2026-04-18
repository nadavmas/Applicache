/**
 * Stable URL comparison for duplicate detection (ignore query/trailing slash case).
 * @param {string} u
 * @returns {string}
 */
function normalizeUrlForDedup(u) {
  const s = String(u).trim()
  if (!s) return ""
  try {
    const x = new URL(s)
    return `${x.origin}${x.pathname}`.replace(/\/$/, "").toLowerCase()
  } catch {
    return s.toLowerCase().replace(/\/$/, "")
  }
}

/**
 * @param {unknown[]} rows
 * @param {string} pageUrl
 * @param {string} extractedJobUrl
 * @returns {boolean}
 */
function jobUrlAlreadyCached(rows, pageUrl, extractedJobUrl) {
  const targets = [
    normalizeUrlForDedup(pageUrl),
    normalizeUrlForDedup(extractedJobUrl),
  ].filter(Boolean)
  if (targets.length === 0) return false

  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const cells =
      row.cells && typeof row.cells === "object" && !Array.isArray(row.cells)
        ? row.cells
        : {}
    for (const v of Object.values(cells)) {
      const nv = normalizeUrlForDedup(v)
      if (!nv) continue
      for (const t of targets) {
        if (t && nv === t) return true
      }
    }
  }
  return false
}

/**
 * First non-empty URL/Link column value after mapping (for duplicate detection).
 * @param {{ id: string, name: string }[]} columns
 * @param {Record<string, string>} cells
 * @returns {string}
 */
function secondaryUrlForDedup(columns, cells) {
  for (const col of columns) {
    const cn = String(col.name ?? "").toLowerCase()
    if (!cn.includes("url") && !cn.includes("link")) continue
    const v = cells[col.id]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

module.exports = {
  normalizeUrlForDedup,
  jobUrlAlreadyCached,
  secondaryUrlForDedup,
}
