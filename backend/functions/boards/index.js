const {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { randomUUID } = require("crypto")

const client = new DynamoDBClient({})

const DEFAULT_COLUMN_NAMES = ["Company", "Job Title", "Status"]

const CORS_ORIGIN = "http://localhost:5173"

const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
}

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    ...corsHeaders,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
})

/** REST API (v1) Cognito pool authorizer: claims map on authorizer */
const getSub = (event) =>
  event.requestContext?.authorizer?.claims?.sub ?? null

/** REST proxy: httpMethod */
const getHttpMethod = (event) => {
  if (event.httpMethod) return String(event.httpMethod).toUpperCase()
  return event.requestContext?.http?.method?.toUpperCase() ?? ""
}

const buildDefaultColumns = () =>
  DEFAULT_COLUMN_NAMES.map((name) => ({
    id: randomUUID(),
    name,
  }))

/** Map DynamoDB row to API row shape */
const mapRowForApi = (r) => {
  if (!r || typeof r !== "object") return null
  const id = typeof r.id === "string" ? r.id : null
  if (!id) return null
  const cells =
    r.cells && typeof r.cells === "object" && !Array.isArray(r.cells)
      ? r.cells
      : {}
  return { id, cells }
}

exports.handler = async (event) => {
  const method = getHttpMethod(event)

  const tableName = process.env.TABLE_NAME
  if (!tableName) {
    return json(500, { message: "Server configuration error" })
  }

  const sub = getSub(event)
  if (!sub) {
    return json(401, { message: "Unauthorized" })
  }

  if (method === "GET") {
    const pk = `USER#${sub}`
    const res = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skp)",
        ExpressionAttributeValues: marshall({
          ":pk": pk,
          ":skp": "BOARD#",
        }),
      }),
    )

    const boards = (res.Items ?? []).map((item) => {
      const row = unmarshall(item)
      const rawRows = Array.isArray(row.rows) ? row.rows : []
      const columns = Array.isArray(row.columns) ? row.columns : []
      const rows = rawRows.map(mapRowForApi).filter(Boolean)
      const createdAt = row.createdAt ?? ""
      return {
        boardId: row.boardId ?? row.SK?.replace(/^BOARD#/, "") ?? "",
        boardName: row.boardName ?? "",
        entityType: row.entityType ?? "BOARD",
        createdAt,
        updatedAt: row.updatedAt ?? createdAt,
        columns,
        rows,
      }
    })

    return json(200, { boards })
  }

  if (method === "POST") {
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

    const boardName =
      typeof payload.boardName === "string" ? payload.boardName.trim() : ""
    if (!boardName) {
      return json(400, { message: "boardName is required" })
    }

    const boardId = randomUUID()
    const now = new Date().toISOString()
    const columns = buildDefaultColumns()
    const item = {
      PK: `USER#${sub}`,
      SK: `BOARD#${boardId}`,
      entityType: "BOARD",
      boardId,
      boardName,
      createdAt: now,
      updatedAt: now,
      columns,
      rows: [],
    }

    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(item),
      }),
    )

    return json(201, {
      boardId,
      boardName,
      entityType: "BOARD",
      createdAt: now,
      updatedAt: now,
      columns,
      rows: [],
    })
  }

  return json(405, { message: "Method not allowed" })
}
