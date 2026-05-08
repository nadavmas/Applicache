const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { randomUUID } = require("node:crypto")

const s3 = new S3Client({})

const CORS_ALLOW_HEADERS =
  "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
const CORS_ALLOW_METHODS = "OPTIONS,GET,POST,PATCH,DELETE"

/** @type {string[] | null} */
let memoCorsAllowedOrigins = null

function normalizeOrigin(value) {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "")
}

function getCorsAllowedOriginsList() {
  if (memoCorsAllowedOrigins != null) return memoCorsAllowedOrigins
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? ""
  memoCorsAllowedOrigins = raw
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean)
  return memoCorsAllowedOrigins
}

/**
 * @param {{ headers?: Record<string, string | undefined> }} event
 * @returns {string | null} Exact origin to echo in Access-Control-Allow-Origin, or null if disallowed.
 */
function resolveAllowedOrigin(event) {
  const allowed = getCorsAllowedOriginsList()
  if (allowed.length === 0) return null
  const raw = event.headers?.Origin ?? event.headers?.origin ?? ""
  const norm = normalizeOrigin(raw)
  if (!norm) return null
  return allowed.some((a) => normalizeOrigin(a) === norm) ? norm : null
}

/**
 * @param {{ headers?: Record<string, string | undefined> }} event
 */
function buildCorsHeaders(event) {
  const acao = resolveAllowedOrigin(event)
  /** @type {Record<string, string>} */
  const h = {
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
  }
  if (acao) h["Access-Control-Allow-Origin"] = acao
  return h
}

const getSub = (event) =>
  event.requestContext?.authorizer?.claims?.sub ?? null

const getHttpMethod = (event) => {
  if (event.httpMethod) return String(event.httpMethod).toUpperCase()
  return event.requestContext?.http?.method?.toUpperCase() ?? ""
}

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

const MAX_FILE_NAME_LEN = 200
const MAX_CONTENT_TYPE_LEN = 100

/**
 * Sanitize client file name to a single path segment (no slashes, no control chars).
 * @param {string} raw
 */
function sanitizeFileName(raw) {
  let s = String(raw ?? "")
    .replace(/[/\\\x00-\x1f]/g, "_")
    .trim()
  s = s.replace(/^\.+/, "")
  if (!s) return "resume"
  if (s.length > MAX_FILE_NAME_LEN) s = s.slice(0, MAX_FILE_NAME_LEN)
  return s
}

exports.handler = async (event) => {
  const method = getHttpMethod(event)

  const corsHeadersFor = () => buildCorsHeaders(event)
  const json = (statusCode, body) => ({
    statusCode,
    headers: {
      ...corsHeadersFor(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        ...corsHeadersFor(),
        "Access-Control-Max-Age": "86400",
      },
      body: "",
    }
  }

  if (method !== "POST") {
    return json(405, { message: "Method not allowed" })
  }

  const rawBucket = process.env.RAW_BUCKET_NAME
  const processedBucket = process.env.PROCESSED_BUCKET_NAME
  if (!rawBucket || !processedBucket) {
    return json(500, { message: "Server configuration error" })
  }

  const sub = getSub(event)
  if (!sub) {
    return json(401, { message: "Unauthorized" })
  }

  let payload = {}
  try {
    const raw = event.body ?? "{}"
    const text = event.isBase64Encoded
      ? Buffer.from(raw, "base64").toString("utf8")
      : raw
    payload = JSON.parse(text)
  } catch {
    return json(400, { message: "Invalid JSON body" })
  }

  const fileNameRaw =
    payload.fileName != null ? String(payload.fileName).trim() : ""
  if (!fileNameRaw) {
    return json(400, { message: "fileName is required" })
  }

  const contentTypeRaw =
    payload.contentType != null ? String(payload.contentType).trim() : ""
  if (!contentTypeRaw) {
    return json(400, { message: "contentType is required" })
  }
  if (contentTypeRaw.length > MAX_CONTENT_TYPE_LEN) {
    return json(400, { message: "contentType is too long" })
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentTypeRaw)) {
    return json(415, { message: "Unsupported content type" })
  }

  const safeFileName = sanitizeFileName(fileNameRaw)
  const resumeId = randomUUID()
  const s3Key = `USER#${sub}/${resumeId}_${safeFileName}`

  const cmd = new PutObjectCommand({
    Bucket: rawBucket,
    Key: s3Key,
    ContentType: contentTypeRaw,
  })

  let uploadUrl
  try {
    uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 })
  } catch (err) {
    console.error("generateUploadUrl presign error", err)
    return json(500, { message: "Could not create upload URL" })
  }

  return json(200, {
    uploadUrl,
    resumeId,
    s3Key,
    expiresIn: 300,
    contentType: contentTypeRaw,
  })
}
