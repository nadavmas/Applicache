import { fetchAuthSession } from "aws-amplify/auth"

const getBaseUrl = () => {
  const raw = import.meta.env.VITE_API_URL
  if (!raw || typeof raw !== "string") return null
  return raw.replace(/\/$/, "")
}

export const isBoardsApiConfigured = () => Boolean(getBaseUrl())

const getIdToken = async () => {
  const session = await fetchAuthSession()
  const token = session.tokens?.idToken
  if (!token) return null
  return typeof token.toString === "function" ? token.toString() : String(token)
}

const parseErrorBody = async (res) => {
  try {
    const data = await res.json()
    if (data && typeof data.message === "string") return data.message
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`
}

// CORS + Cognito: browser sends preflight for Authorization / Content-Type; GET only needs Authorization (Bearer id token)
/**
 * @returns {Promise<{
 *   boards: Array<{
 *     boardId: string,
 *     boardName: string,
 *     entityType?: string,
 *     createdAt: string,
 *     updatedAt: string,
 *     columns: Array<{ id: string, name: string }>,
 *     rows: Array<{ id: string, cells: Record<string, string> }>,
 *   }>,
 * }>}
 */
export const listBoards = async () => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const res = await fetch(`${base}/boards`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })
  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.")
  }
  if (!res.ok) {
    throw new Error(await parseErrorBody(res))
  }
  return res.json()
}

/**
 * Fetch one board by id (full columns and rows from DynamoDB).
 * @returns {Promise<{
 *   boardId: string,
 *   boardName: string,
 *   entityType?: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   columns: Array<{ id: string, name: string }>,
 *   rows: Array<{ id: string, cells: Record<string, string> }>,
 * }>}
 */
export const getBoard = async (boardId) => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const pathId = encodeURIComponent(boardId)
  const res = await fetch(`${base}/boards/${pathId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })
  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.")
  }
  if (res.status === 404) {
    throw new Error("Table not found.")
  }
  if (!res.ok) {
    throw new Error(await parseErrorBody(res))
  }
  return res.json()
}

// POST: Authorization + Content-Type: application/json (triggers preflight; API must allow OPTIONS without auth — see SAM AddDefaultAuthorizersToCorsPreflight)
/**
 * @param {string} boardName
 * @param {Array<{ id: string, name: string }>} [columns] When provided (e.g. from a draft), persisted to DynamoDB; otherwise the API uses its default three columns.
 * @returns {Promise<{
 *   boardId: string,
 *   boardName: string,
 *   entityType: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   columns: Array<{ id: string, name: string }>,
 *   rows: Array<{ id: string, cells: Record<string, string> }>,
 * }>}
 */
export const createBoard = async (boardName, columns) => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const body =
    Array.isArray(columns) && columns.length > 0
      ? {
          boardName,
          columns: columns.map((c) => ({
            id: String(c.id),
            name: String(c.name ?? ""),
          })),
        }
      : { boardName }
  const res = await fetch(`${base}/boards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.")
  }
  if (!res.ok) {
    throw new Error(await parseErrorBody(res))
  }
  return res.json()
}

/**
 * Append a row entry to a persisted board (DynamoDB list_append).
 * @param {string} boardId
 * @param {{ cells: Record<string, string> }} entryData
 * @returns {Promise<{
 *   row: { id: string, cells: Record<string, string>, createdAt: string, updatedAt: string },
 *   updatedAt: string,
 * }>}
 */
export const addBoardEntry = async (boardId, entryData) => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const pathId = encodeURIComponent(boardId)
  const res = await fetch(`${base}/boards/${pathId}/entries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cells: entryData.cells }),
  })
  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.")
  }
  if (res.status === 404) {
    throw new Error("Table not found.")
  }
  if (!res.ok) {
    throw new Error(await parseErrorBody(res))
  }
  return res.json()
}

/**
 * Update an existing row on a board (PATCH).
 * @param {string} boardId
 * @param {string} rowId
 * @param {{ cells: Record<string, string> }} entryData
 * @returns {Promise<{
 *   row: { id: string, cells: Record<string, string>, createdAt: string, updatedAt: string },
 *   updatedAt: string,
 * }>}
 */
export const updateBoardEntry = async (boardId, rowId, entryData) => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const b = encodeURIComponent(boardId)
  const r = encodeURIComponent(rowId)
  const res = await fetch(`${base}/boards/${b}/entries/${r}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cells: entryData.cells }),
  })
  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.")
  }
  if (res.status === 404) {
    throw new Error("Table or entry not found.")
  }
  if (!res.ok) {
    throw new Error(await parseErrorBody(res))
  }
  return res.json()
}
