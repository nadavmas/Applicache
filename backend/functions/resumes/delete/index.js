const {
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb")
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")

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

function resolveAllowedOrigin(event) {
  const allowed = getCorsAllowedOriginsList()
  if (allowed.length === 0) return null
  const raw = event.headers?.Origin ?? event.headers?.origin ?? ""
  const norm = normalizeOrigin(raw)
  if (!norm) return null
  return allowed.some((a) => normalizeOrigin(a) === norm) ? norm : null
}

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

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  if (method !== "DELETE") {
    return json(405, { message: "Method not allowed" })
  }

  const tableName = process.env.TABLE_NAME
  const rawBucket = process.env.RAW_BUCKET_NAME
  const processedBucket = process.env.PROCESSED_BUCKET_NAME
  if (!tableName || !rawBucket || !processedBucket) {
    return json(500, { message: "Server configuration error" })
  }

  const sub = getSub(event)
  if (!sub) return json(401, { message: "Unauthorized" })

  const resumeId = String(event.pathParameters?.resumeId ?? "").trim()
  if (!UUID_V4_RE.test(resumeId)) {
    return json(400, { message: "resumeId must be a UUID v4" })
  }

  const pk = `USER#${sub}`
  const sk = `RESUME#${resumeId}`

  const getRes = await dynamo.send(
    new GetItemCommand({
      TableName: tableName,
      Key: marshall({ PK: pk, SK: sk }),
      ConsistentRead: true,
    }),
  )
  if (!getRes.Item) return json(404, { message: "Resume not found" })

  const row = unmarshall(getRes.Item)
  const rawKey = row.s3Key != null ? String(row.s3Key) : null
  const processedTextKey =
    row.processedTextKey != null ? String(row.processedTextKey) : null

  if (rawKey) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: rawBucket,
        Key: rawKey,
      }),
    )
  }
  if (processedTextKey) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: processedBucket,
        Key: processedTextKey,
      }),
    )
  }

  await dynamo.send(
    new DeleteItemCommand({
      TableName: tableName,
      Key: marshall({ PK: pk, SK: sk }),
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    }),
  )

  return {
    statusCode: 204,
    headers: corsHeadersFor(),
    body: "",
  }
}
