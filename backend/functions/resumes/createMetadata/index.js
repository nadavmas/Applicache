const {
  DynamoDBClient,
  PutItemCommand,
  ConditionalCheckFailedException,
} = require("@aws-sdk/client-dynamodb")
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3")
const { marshall } = require("@aws-sdk/util-dynamodb")

const dynamo = new DynamoDBClient({})
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
 * @returns {string | null}
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

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_FILE_NAME_LEN = 200
const MAX_CONTENT_TYPE_LEN = 100
const MAX_BYTES = 10 * 1024 * 1024

/**
 * @param {string} value
 */
function normalizeMimeBase(value) {
  const part = String(value ?? "").split(";")[0].trim().toLowerCase()
  return part
}

/**
 * @param {unknown} err
 */
function isS3NotFound(err) {
  const status = err?.$metadata?.httpStatusCode
  const name = err?.name ?? err?.Code
  return (
    status === 404 ||
    name === "NotFound" ||
    name === "NoSuchKey" ||
    name === "NotFoundException"
  )
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

  const tableName = process.env.TABLE_NAME
  const rawBucket = process.env.RAW_BUCKET_NAME
  const processedBucket = process.env.PROCESSED_BUCKET_NAME
  if (!tableName || !rawBucket || !processedBucket) {
    return json(500, { message: "Server configuration error" })
  }

  const sub = getSub(event)
  if (!sub) {
    return json(401, { message: "Unauthorized" })
  }

  const expectedPrefix = `USER#${sub}/`

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

  const resumeId =
    payload.resumeId != null ? String(payload.resumeId).trim() : ""
  if (!resumeId || !UUID_V4_RE.test(resumeId)) {
    return json(400, { message: "resumeId must be a UUID v4" })
  }

  const fileName =
    payload.fileName != null ? String(payload.fileName).trim() : ""
  if (!fileName || fileName.length > MAX_FILE_NAME_LEN) {
    return json(400, { message: "fileName is required (max 200 chars)" })
  }

  const contentType =
    payload.contentType != null ? String(payload.contentType).trim() : ""
  if (!contentType || contentType.length > MAX_CONTENT_TYPE_LEN) {
    return json(400, { message: "contentType is required" })
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return json(415, { message: "Unsupported content type" })
  }

  const s3Key = payload.s3Key != null ? String(payload.s3Key).trim() : ""
  if (!s3Key || !s3Key.startsWith(expectedPrefix)) {
    return json(403, { message: "Invalid resume object key" })
  }

  if (!s3Key.startsWith(`${expectedPrefix}${resumeId}_`)) {
    return json(400, { message: "s3Key does not match resumeId" })
  }

  let head
  try {
    head = await s3.send(
      new HeadObjectCommand({
        Bucket: rawBucket,
        Key: s3Key,
      }),
    )
  } catch (err) {
    if (isS3NotFound(err)) {
      return json(400, { message: "Resume object not found in storage" })
    }
    console.error("createResumeMetadata HeadObject error", err)
    return json(500, { message: "Could not verify upload" })
  }

  const contentLength = head.ContentLength
  if (contentLength == null || typeof contentLength !== "number") {
    return json(400, { message: "Could not read object size" })
  }
  if (contentLength <= 0) {
    return json(400, { message: "Invalid object size" })
  }
  if (contentLength > MAX_BYTES) {
    return json(413, { message: `Object exceeds maximum size (${MAX_BYTES} bytes)` })
  }

  const headType = normalizeMimeBase(head.ContentType ?? "")
  const bodyType = normalizeMimeBase(contentType)
  if (!headType || headType !== bodyType) {
    return json(400, { message: "Content-Type mismatch with stored object" })
  }

  const sizeBytes = contentLength
  const uploadedAt = new Date().toISOString()

  const item = {
    PK: `USER#${sub}`,
    SK: `RESUME#${resumeId}`,
    entityType: "RESUME",
    resumeId,
    fileName,
    s3Key,
    contentType,
    sizeBytes,
    uploadedAt,
    processingStatus: "PROCESSING",
  }

  try {
    await dynamo.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item),
        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      }),
    )
  } catch (err) {
    if (
      err instanceof ConditionalCheckFailedException ||
      err?.name === "ConditionalCheckFailedException"
    ) {
      return json(409, { message: "Resume metadata already exists" })
    }
    console.error("createResumeMetadata PutItem error", err)
    return json(500, { message: "Could not save metadata" })
  }

  const { PK: _pk, SK: _sk, ...rest } = item
  return json(201, rest)
}
