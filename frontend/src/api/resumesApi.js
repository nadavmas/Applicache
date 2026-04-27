import { fetchAuthSession } from "aws-amplify/auth"

const getBaseUrl = () => {
  const raw = import.meta.env.VITE_API_URL
  if (!raw || typeof raw !== "string") return null
  return raw.replace(/\/$/, "")
}

export const isResumesApiConfigured = () => Boolean(getBaseUrl())

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

/** Must match backend ALLOWED_CONTENT_TYPES (generateUploadUrl / createMetadata). */
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  DOCX_MIME,
])

const normalizeMimeFromFile = (type) => {
  const s = String(type ?? "").trim()
  if (!s) return ""
  return s.split(";")[0].trim()
}

const extensionContentType = (fileName) => {
  const lower = String(fileName ?? "").toLowerCase()
  if (lower.endsWith(".docx")) return DOCX_MIME
  if (lower.endsWith(".doc")) return "application/msword"
  if (lower.endsWith(".pdf")) return "application/pdf"
  return null
}

/**
 * Resolve a backend-allowed Content-Type: prefer file.type when it matches; else map from extension.
 * .docx is always mapped to the full OpenXML MIME string required by the API.
 * @param {File} file
 * @returns {string}
 */
/**
 * Map API resume DTO to sidebar list item shape.
 * @param {object} r
 */
export const resumeFromServer = (r) => ({
  id: r.resumeId,
  name: r.fileName,
  ...r,
})

/**
 * @returns {Promise<{ resumes: Array<Record<string, unknown>> }>}
 */
export const listResumes = async () => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const res = await fetch(`${base}/resumes`, {
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

export const resolveResumeContentType = (file) => {
  if (!(file instanceof File)) {
    throw new Error("Invalid file")
  }
  const fromType = normalizeMimeFromFile(file.type)
  if (fromType && ALLOWED_CONTENT_TYPES.has(fromType)) {
    return fromType
  }
  const fromExt = extensionContentType(file.name)
  if (fromExt) return fromExt
  throw new Error(
    "Could not determine a supported file type. Use PDF, DOC, or DOCX.",
  )
}

/**
 * @param {string} fileName
 * @param {string} contentType
 * @returns {Promise<{
 *   uploadUrl: string,
 *   resumeId: string,
 *   s3Key: string,
 *   expiresIn: number,
 *   contentType: string,
 * }>}
 */
export const getResumeUploadUrl = async (fileName, contentType) => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const res = await fetch(`${base}/resumes/upload-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileName, contentType }),
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
 * @param {string} resumeId
 * @param {string} fileName
 * @param {string} s3Key
 * @param {string} contentType
 * @returns {Promise<{
 *   entityType: string,
 *   resumeId: string,
 *   fileName: string,
 *   s3Key: string,
 *   contentType: string,
 *   sizeBytes: number,
 *   uploadedAt: string,
 * }>}
 */
export const createResumeMetadata = async (
  resumeId,
  fileName,
  s3Key,
  contentType,
) => {
  const base = getBaseUrl()
  if (!base) {
    throw new Error("VITE_API_URL is not set")
  }
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error("Not signed in")
  }
  const res = await fetch(`${base}/resumes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resumeId, fileName, s3Key, contentType }),
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
 * PUT the file bytes to a pre-signed S3 URL. No Authorization header — the URL is signed.
 * @param {string} uploadUrl
 * @param {File} file
 * @param {string} contentType — must match the value used when the URL was signed
 * @returns {Promise<void>}
 */
export const uploadFileToS3 = async (uploadUrl, file, contentType) => {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  })
  if (!res.ok) {
    const text = await res.text()
    const hint = text?.trim() ? ` ${text.slice(0, 200)}` : ""
    throw new Error(
      `S3 upload failed (${res.status}${hint})`,
    )
  }
}
