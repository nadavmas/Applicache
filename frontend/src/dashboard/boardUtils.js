/** @typedef {{ id: string, name: string }} Column */
/** @typedef {{ id: string, cells: Record<string, string>, pendingSave?: boolean }} Row */
/** @typedef {{
 *   id: string,
 *   name: string,
 *   columns: Column[],
 *   rows: Row[],
 *   entriesEnabled: boolean,
 *   persisted: boolean,
 *   columnsLocked: boolean,
 * }} Board */

const newId = () => crypto.randomUUID()

const DEFAULT_COLUMN_NAMES = ["Company", "Job Title", "Status"]

/**
 * @param {string} name
 * @returns {Board}
 */
export const createEmptyBoard = (name) => {
  const columns = DEFAULT_COLUMN_NAMES.map((colName) => ({
    id: newId(),
    name: colName,
  }))
  return {
    id: newId(),
    name,
    columns,
    rows: [],
    entriesEnabled: false,
    persisted: false,
    columnsLocked: true,
  }
}

/**
 * @param {unknown} raw
 * @returns {Column[]}
 */
const normalizeColumns = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_COLUMN_NAMES.map((colName) => ({
      id: newId(),
      name: colName,
    }))
  }
  const mapped = raw
    .map((c) => {
      if (!c || typeof c !== "object") return null
      const id =
        c.id != null && String(c.id).trim() !== ""
          ? String(c.id).trim()
          : ""
      const name = c.name != null ? String(c.name).trim() : ""
      if (!id) return null
      return { id, name: name || "Column" }
    })
    .filter(Boolean)
  if (mapped.length === 0) {
    return DEFAULT_COLUMN_NAMES.map((colName) => ({
      id: newId(),
      name: colName,
    }))
  }
  return mapped
}

/**
 * @param {unknown} raw
 * @param {Column[]} columns
 * @returns {Row[]}
 */
const normalizeRows = (raw, columns) => {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    if (!r || typeof r !== "object") {
      return {
        id: newId(),
        cells: Object.fromEntries(columns.map((c) => [c.id, ""])),
        pendingSave: false,
      }
    }
    const id = typeof r.id === "string" && r.id ? r.id : newId()
    let cells = {}
    if (
      r.cells &&
      typeof r.cells === "object" &&
      !Array.isArray(r.cells)
    ) {
      cells = { ...r.cells }
    } else {
      cells = Object.fromEntries(columns.map((c) => [c.id, ""]))
    }
    for (const c of columns) {
      if (cells[c.id] === undefined) cells[c.id] = ""
    }
    return { id, cells, pendingSave: false }
  })
}

/**
 * Build a client Board from API payload (preserves server boardId and column ids).
 * @param {{
 *   boardId: string,
 *   boardName: string,
 *   columns?: Array<{ id?: string, name?: string }>,
 *   rows?: Array<{ id?: string, cells?: Record<string, string> }>,
 * }} server
 * @returns {Board}
 */
export const boardFromServer = (server) => {
  const boardId = server.boardId
  const boardName = server.boardName ?? ""
  const columns = normalizeColumns(server.columns)
  const rows = normalizeRows(server.rows, columns)
  const hasEntries = rows.length > 0
  return {
    id: boardId,
    name: boardName,
    columns,
    rows,
    entriesEnabled: hasEntries,
    persisted: true,
    columnsLocked: true,
  }
}

/**
 * @param {Board} board
 * @param {string} columnName
 * @returns {Board}
 */
export const addColumnToBoard = (board, columnName) => {
  const col = { id: newId(), name: columnName }
  const nextRows = board.rows.map((row) => ({
    ...row,
    cells: { ...row.cells, [col.id]: "" },
  }))
  return {
    ...board,
    columns: [...board.columns, col],
    rows: nextRows,
  }
}

/**
 * @param {Board} board
 * @returns {Board}
 */
export const addRowToBoard = (board) => {
  const cells = Object.fromEntries(
    board.columns.map((c) => [c.id, ""]),
  )
  const row = { id: newId(), cells, pendingSave: true }
  return {
    ...board,
    rows: [...board.rows, row],
  }
}

/**
 * @param {Board} board
 * @param {string} rowId
 * @param {string} columnId
 * @param {string} value
 * @returns {Board}
 */
export const updateCell = (board, rowId, columnId, value) => ({
  ...board,
  rows: board.rows.map((row) =>
    row.id !== rowId
      ? row
      : {
          ...row,
          cells: { ...row.cells, [columnId]: value },
        },
  ),
})
