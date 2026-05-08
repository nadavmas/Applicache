const {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} = require("@aws-sdk/client-dynamodb")
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const pdfParse = require("pdf-parse")
const mammoth = require("mammoth")

const dynamo = new DynamoDBClient({})
const s3 = new S3Client({})

const PARSEABLE_EXTENSIONS = new Set([".pdf", ".docx"])
const EXPLICIT_UNSUPPORTED_EXTENSIONS = new Set([
  ".doc",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".webp",
  ".heic",
])

function getFileExtension(key) {
  const leaf = String(key ?? "").split("/").pop() ?? ""
  const idx = leaf.lastIndexOf(".")
  if (idx <= 0) return ""
  return leaf.slice(idx).toLowerCase()
}

function parseResumeContextFromKey(key) {
  const raw = String(key ?? "")
  const slashIndex = raw.indexOf("/")
  if (slashIndex <= 0) return null
  const userPk = raw.slice(0, slashIndex)
  if (!userPk.startsWith("USER#")) return null

  const filePart = raw.slice(slashIndex + 1)
  const underscoreIndex = filePart.indexOf("_")
  if (underscoreIndex <= 0) return null
  const resumeId = filePart.slice(0, underscoreIndex)
  if (!resumeId) return null

  return {
    userPk,
    resumeId,
    resumeSk: `RESUME#${resumeId}`,
  }
}

async function updateStatus(tableName, key, status, extras = {}) {
  const now = new Date().toISOString()
  const values = {
    ":status": status,
    ":updatedAt": now,
    ...extras,
  }
  let expr = "SET processingStatus = :status, processingUpdatedAt = :updatedAt"
  if (Object.prototype.hasOwnProperty.call(extras, ":processedTextKey")) {
    expr += ", processedTextKey = :processedTextKey"
  }
  if (Object.prototype.hasOwnProperty.call(extras, ":processedUrl")) {
    expr += ", processedUrl = :processedUrl"
  }
  if (Object.prototype.hasOwnProperty.call(extras, ":processingError")) {
    expr += ", processingError = :processingError"
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: tableName,
      Key: marshall({ PK: key.userPk, SK: key.resumeSk }),
      UpdateExpression: expr,
      ExpressionAttributeValues: marshall(values),
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    }),
  )
}

async function bodyToBuffer(body) {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }

  const chunks = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function parseFileBuffer(extension, fileBuffer) {
  if (extension === ".pdf") {
    const parsed = await pdfParse(fileBuffer)
    return String(parsed?.text ?? "")
  }
  if (extension === ".docx") {
    const parsed = await mammoth.extractRawText({ buffer: fileBuffer })
    return String(parsed?.value ?? "")
  }
  return ""
}

exports.handler = async (event) => {
  const tableName = process.env.TABLE_NAME
  const rawBucket = process.env.RAW_BUCKET_NAME
  const processedBucket = process.env.PROCESSED_BUCKET_NAME
  if (!tableName || !rawBucket || !processedBucket) {
    throw new Error("Missing required environment configuration")
  }

  for (const record of event.Records ?? []) {
    if (record.eventSource !== "aws:s3") continue
    const bucketName = record.s3?.bucket?.name
    const encodedKey = record.s3?.object?.key
    if (!bucketName || !encodedKey || bucketName !== rawBucket) continue

    const objectKey = decodeURIComponent(String(encodedKey).replace(/\+/g, " "))
    const parsed = parseResumeContextFromKey(objectKey)
    if (!parsed) {
      console.warn("Skipping unknown resume key format", { objectKey })
      continue
    }

    const extension = getFileExtension(objectKey)
    if (
      EXPLICIT_UNSUPPORTED_EXTENSIONS.has(extension) ||
      !PARSEABLE_EXTENSIONS.has(extension)
    ) {
      await updateStatus(tableName, parsed, "UNSUPPORTED_FORMAT")
      continue
    }

    try {
      const maybeResume = await dynamo.send(
        new GetItemCommand({
          TableName: tableName,
          Key: marshall({ PK: parsed.userPk, SK: parsed.resumeSk }),
          ConsistentRead: true,
        }),
      )
      if (!maybeResume.Item) {
        console.warn("Resume metadata not found for uploaded object", {
          objectKey,
          resumeSk: parsed.resumeSk,
        })
        continue
      }

      const current = unmarshall(maybeResume.Item)
      if (current.processingStatus === "READY") continue
      if (current.processingStatus === "UNSUPPORTED_FORMAT") continue

      const source = await s3.send(
        new GetObjectCommand({
          Bucket: rawBucket,
          Key: objectKey,
        }),
      )
      const fileBuffer = await bodyToBuffer(source.Body)
      const extractedText = await parseFileBuffer(extension, fileBuffer)

      const processedTextKey = `${parsed.userPk}/${parsed.resumeId}_parsed.txt`
      const processedUrl = `s3://${processedBucket}/${processedTextKey}`

      await s3.send(
        new PutObjectCommand({
          Bucket: processedBucket,
          Key: processedTextKey,
          ContentType: "text/plain; charset=utf-8",
          Body: extractedText,
        }),
      )

      await updateStatus(tableName, parsed, "READY", {
        ":processedTextKey": processedTextKey,
        ":processedUrl": processedUrl,
      })
    } catch (error) {
      console.error("Resume parsing failed", { objectKey, error })
      await updateStatus(tableName, parsed, "FAILED", {
        ":processingError": String(error?.message ?? "Unknown processing error"),
      })
    }
  }
}
