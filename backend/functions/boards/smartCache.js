const { GetItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { randomUUID } = require("crypto")
const OpenAI = require("openai")
const { jobUrlAlreadyCached, secondaryUrlForDedup } = require("./boardDedup")

const RAW_TEXT_MAX_CHARS = 12000

/**
 * @param {unknown} v
 * @returns {string}
 */
function aiValueToPlainString(v) {
  if (v == null) return ""
  const t = typeof v
  if (t === "string") return v
  if (t === "number" || t === "boolean") return String(v)
  return ""
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {Record<string, string>}
 */
function buildLowerKeyLookup(parsed) {
  /** @type {Record<string, string>} */
  const lookup = Object.create(null)
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof k !== "string") continue
    const lk = k.trim().toLowerCase()
    if (!lk) continue
    lookup[lk] = aiValueToPlainString(v)
  }
  return lookup
}

/**
 * @param {string[]} columnNames
 * @returns {string}
 */
function buildSystemPrompt(columnNames) {
  const namesJoined = columnNames.join(", ")
  return [
    "You are a job application parser. Extract information from the provided text for these specific fields:",
    namesJoined + ".",
    "Return ONLY a JSON object where the keys are the exact field names provided.",
    'If a field is not found in the text, return an empty string for that key.',
    "For fields whose names refer to application status, if you cannot find a status, return \"Applied\".",
    "Match the language of each extracted value to the original source text — do not translate or localize company names, titles, or other text.",
    "All values must be concise plain strings (no markdown, no nested JSON).",
    "Keep extracted values concise.",
  ].join(" ")
}

/**
 * @param {{ id: string, name: string }[]} columns
 * @param {Record<string, string>} lookup
 * @param {string} pageUrl
 * @returns {Record<string, string>}
 */
function mapAiLookupToCells(columns, lookup, pageUrl) {
  /** @type {Record<string, string>} */
  const cells = {}
  for (const col of columns) {
    const nameKey = String(col.name ?? "").trim().toLowerCase()
    let val = nameKey ? lookup[nameKey] ?? "" : ""

    const cn = String(col.name ?? "").toLowerCase()
    if ((cn.includes("url") || cn.includes("link")) && !val.trim()) {
      val = pageUrl
    }
    if (cn.includes("status") && !val.trim()) {
      val = "Applied"
    }
    cells[col.id] = val
  }
  return cells
}

/**
 * POST /boards/{boardId}/smart-cache — OpenAI extraction + append row.
 * @param {{
 *   client: import("@aws-sdk/client-dynamodb").DynamoDBClient,
 *   tableName: string,
 *   pk: string,
 *   pathBoardId: string,
 *   payload: Record<string, unknown>,
 *   json: (statusCode: number, body: object) => object,
 *   sanitizeColumns: (raw: unknown) => { id: string, name: string }[],
 *   normalizeCellsForBoard: (columns: { id: string, name: string }[], cellsRaw: unknown) => { ok: boolean, message?: string, cells?: Record<string, string> },
 *   cellsHaveAtLeastOneNonWhitespaceValue: (cells: Record<string, string>) => boolean,
 * }} ctx
 */
async function handleSmartCache(ctx) {
  const {
    client,
    tableName,
    pk,
    pathBoardId,
    payload,
    json,
    sanitizeColumns,
    normalizeCellsForBoard,
    cellsHaveAtLeastOneNonWhitespaceValue,
  } = ctx

  const previewOnly = payload.previewOnly === true

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !String(apiKey).trim()) {
    return json(500, { message: "Server configuration error" })
  }

  const rawText =
    typeof payload.rawText === "string" ? payload.rawText : ""
  const pageUrl = typeof payload.url === "string" ? payload.url : ""
  if (!rawText || !pageUrl) {
    return json(400, { message: "rawText and url are required strings" })
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

  const columnNames = columns.map((c) => c.name).filter(Boolean)
  const openai = new OpenAI({ apiKey: String(apiKey).trim() })
  const textSlice = rawText.slice(0, RAW_TEXT_MAX_CHARS)

  /** @type {Record<string, unknown>} */
  let parsed
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(columnNames),
        },
        { role: "user", content: textSlice },
      ],
    })
    const content = completion.choices[0]?.message?.content
    if (!content) {
      return json(502, { message: "Could not extract job data" })
    }
    const top = JSON.parse(content)
    if (!top || typeof top !== "object" || Array.isArray(top)) {
      return json(502, { message: "Could not extract job data" })
    }
    parsed = top
  } catch (e) {
    const msg = e instanceof Error ? e.message : "openai_error"
    console.log(
      JSON.stringify({ type: "smart-cache-openai-error", message: msg }),
    )
    return json(502, { message: "Could not extract job data" })
  }

  const lookup = buildLowerKeyLookup(parsed)
  const cellsRaw = mapAiLookupToCells(columns, lookup, pageUrl)

  const normalized = normalizeCellsForBoard(columns, cellsRaw)
  if (!normalized.ok) {
    return json(400, { message: normalized.message ?? "Invalid cells" })
  }

  if (
    !normalized.cells ||
    !cellsHaveAtLeastOneNonWhitespaceValue(normalized.cells)
  ) {
    return json(400, {
      message: "Could not extract enough data for this board.",
    })
  }

  const existingRows = Array.isArray(boardRow.rows) ? boardRow.rows : []
  const isDuplicate = jobUrlAlreadyCached(
    existingRows,
    pageUrl,
    secondaryUrlForDedup(columns, normalized.cells),
  )

  if (previewOnly) {
    return json(200, {
      cells: normalized.cells,
      columns,
      isDuplicate,
      message: isDuplicate ? "Job already cached" : "",
    })
  }

  if (isDuplicate) {
    return json(409, {
      message: "Job already cached",
      cells: normalized.cells,
      columns,
      isDuplicate: true,
    })
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

module.exports = { handleSmartCache }
