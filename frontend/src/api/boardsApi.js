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

// POST: Authorization + Content-Type: application/json (triggers preflight; API must allow OPTIONS without auth — see SAM AddDefaultAuthorizersToCorsPreflight)
/**
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
export const createBoard = async (boardName) => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const res = await fetch(`${base}/boards`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ boardName }),
  })
  if (res.status === 401) {
    throw new Error("Session expired. Please sign in again.")
  }
  if (!res.ok) {
    throw new Error(await parseErrorBody(res))
  }
  return res.json()
}
