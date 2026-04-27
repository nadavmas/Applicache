const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")

const dynamo = new DynamoDBClient({})

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

/**
 * @param {Record<string, unknown>} row
 */
const toResumeDto = (row) => {
  if (row == null || typeof row !== "object") return null
  if (String(row.entityType ?? "") !== "RESUME") return null
  const id = row.resumeId != null ? String(row.resumeId).trim() : ""
  if (!id) return null
  const { PK, SK, ...rest } = row
  void PK
  void SK
  return rest
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

  if (method !== "GET") {
    return json(405, { message: "Method not allowed" })
  }

  const tableName = process.env.TABLE_NAME
  if (!tableName) {
    return json(500, { message: "Server configuration error" })
  }

  const sub = getSub(event)
  if (!sub) {
    return json(401, { message: "Unauthorized" })
  }

  const pk = `USER#${sub}`

  let res
  try {
    res = await dynamo.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skp)",
        ExpressionAttributeValues: marshall({
          ":pk": pk,
          ":skp": "RESUME#",
        }),
      }),
    )
  } catch (err) {
    console.error("listResumes Query error", err)
    return json(500, { message: "Could not load resumes" })
  }

  const rows = (res.Items ?? []).map((item) => unmarshall(item))
  const resumeDtos = []
  for (const row of rows) {
    const dto = toResumeDto(row)
    if (dto) resumeDtos.push(dto)
  }
  resumeDtos.sort((a, b) =>
    String(b.uploadedAt ?? "").localeCompare(String(a.uploadedAt ?? "")),
  )

  return json(200, { resumes: resumeDtos })
}
