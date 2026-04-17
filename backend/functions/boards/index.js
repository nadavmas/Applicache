const {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
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

/**
 * Normalize columns from DynamoDB (list of maps) into stable { id, name }[].
 * Handles odd shapes after unmarshall and drops invalid entries.
 */
const sanitizeColumns = (raw) => {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const c of raw) {
    if (!c || typeof c !== "object") continue
    const id = c.id != null ? String(c.id).trim() : ""
    const name = c.name != null ? String(c.name).trim() : ""
    if (!id) continue
    out.push({ id, name: name || "Column" })
  }
  return out
}

/**
 * Ensure cells keys match board column ids exactly; return normalized string map.
 */
const normalizeCellsForBoard = (columns, cellsRaw) => {
  if (!cellsRaw || typeof cellsRaw !== "object" || Array.isArray(cellsRaw)) {
    return { ok: false, message: "cells must be a non-array object" }
  }
  const columnIds = columns.map((c) => c.id)
  const allowed = new Set(columnIds)
  const keys = Object.keys(cellsRaw)
  for (const k of keys) {
    if (!allowed.has(k)) {
      return {
        ok: false,
        message: `Unknown column id in cells: ${k}`,
      }
    }
  }
  for (const id of columnIds) {
    if (!Object.prototype.hasOwnProperty.call(cellsRaw, id)) {
      return {
        ok: false,
        message: `Missing column id in cells: ${id}`,
      }
    }
  }
  const out = {}
  for (const id of columnIds) {
    const v = cellsRaw[id]
    out[id] = v == null ? "" : String(v)
  }
  return { ok: true, cells: out }
}

/** Map DynamoDB row to API row shape */
const mapRowForApi = (r) => {
  if (!r || typeof r !== "object") return null
  const id =
    typeof r.rowId === "string"
      ? r.rowId
      : typeof r.id === "string"
        ? r.id
        : null
  if (!id) return null
  const cells =
    r.cells && typeof r.cells === "object" && !Array.isArray(r.cells)
      ? r.cells
      : {}
  return { id, cells }
}

const buildBoardDto = (row) => {
  const rawRows = Array.isArray(row.rows) ? row.rows : []
  const columns = sanitizeColumns(row.columns)
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

  const pk = `USER#${sub}`

  if (method === "GET") {
    const pathBoardId =
      event.pathParameters?.boardId != null
        ? String(event.pathParameters.boardId).trim()
        : ""

    if (pathBoardId) {
      const res = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: pk,
            SK: `BOARD#${pathBoardId}`,
          }),
        }),
      )
      if (!res.Item) {
        return json(404, { message: "Board not found" })
      }
      const row = unmarshall(res.Item)
      if (!String(row.SK ?? "").startsWith("BOARD#")) {
        return json(404, { message: "Board not found" })
      }
      return json(200, buildBoardDto(row))
    }

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

    const boards = (res.Items ?? []).map((item) =>
      buildBoardDto(unmarshall(item)),
    )

    return json(200, { boards })
  }

  if (method === "POST") {
    const pathBoardId =
      event.pathParameters?.boardId != null
        ? String(event.pathParameters.boardId).trim()
        : ""

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

    if (pathBoardId) {
      const cellsPayload = payload.cells
      if (
        !cellsPayload ||
        typeof cellsPayload !== "object" ||
        Array.isArray(cellsPayload)
      ) {
        return json(400, { message: "cells must be a non-array object" })
      }

      const getRes = await client.send(
        new GetItemCommand({
          TableName: tableName,
          Key: marshall({
            PK: pk,
            SK: `BOARD#${pathBoardId}`,
          }),
        }),
      )
      if (!getRes.Item) {
        return json(404, { message: "Board not found" })
      }
      const boardRow = unmarshall(getRes.Item)
      if (!String(boardRow.SK ?? "").startsWith("BOARD#")) {
        return json(404, { message: "Board not found" })
      }

      const columns = sanitizeColumns(boardRow.columns)
      if (columns.length === 0) {
        return json(400, { message: "Board has no columns" })
      }

      const normalized = normalizeCellsForBoard(columns, cellsPayload)
      if (!normalized.ok) {
        return json(400, { message: normalized.message })
      }

      const rowId = randomUUID()
      const now = new Date().toISOString()
      const newEntry = {
        rowId,
        cells: normalized.cells,
        createdAt: now,
        updatedAt: now,
      }

      try {
        await client.send(
          new UpdateItemCommand({
            TableName: tableName,
            Key: marshall({
              PK: pk,
              SK: `BOARD#${pathBoardId}`,
            }),
            UpdateExpression:
              "SET #rows = list_append(if_not_exists(#rows, :empty), :one), #updatedAt = :u",
            ExpressionAttributeNames: {
              "#rows": "rows",
              "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues: marshall({
              ":empty": [],
              ":one": [newEntry],
              ":u": now,
            }),
            ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
          }),
        )
      } catch (e) {
        if (e.name === "ConditionalCheckFailedException") {
          return json(404, { message: "Board not found" })
        }
        throw e
      }

      return json(201, {
        row: {
          id: rowId,
          cells: normalized.cells,
          createdAt: now,
          updatedAt: now,
        },
        updatedAt: now,
      })
    }

    const boardName =
      typeof payload.boardName === "string" ? payload.boardName.trim() : ""
    if (!boardName) {
      return json(400, { message: "boardName is required" })
    }

    const boardId = randomUUID()
    const now = new Date().toISOString()
    const MAX_COLUMNS = 64
    const fromClient = sanitizeColumns(payload.columns).slice(0, MAX_COLUMNS)
    const columns =
      fromClient.length > 0 ? fromClient : buildDefaultColumns()
    const item = {
      PK: pk,
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
