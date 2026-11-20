import type { OutlineFormat } from "@olai/format"
import { isIsoInstant, type Claims } from "@olai/format"
import { Result, Schema } from "effect"
import * as SchemaIssue from "effect/SchemaIssue"
import { type Outline, outlineDocument } from "@olai/format"
import type { OutlineError } from "@olai/format"
import {
  ID_SHAPE,
  isMirror,
  type Located,
  MARKS,
  MirrorNode,
  type Node,
  RegularNode,
} from "@olai/format"
import { canonicalRepeat, REPEAT_GRAMMAR } from "@olai/format"
import { nothing, heldCustom } from "@olai/format"
import { type Custom, type CustomValue, customKeys } from "@olai/format"



const options = {
  errors: "all",
  onExcessProperty: "error",
} as const

const decodeRegular = Schema.decodeUnknownResult(RegularNode, options)
const decodeMirror = Schema.decodeUnknownResult(MirrorNode, options)

const decodeRecord = (
  json: Record<string, unknown>,
): Result.Result<Node, Schema.SchemaError> =>
  "mirror" in json ? decodeMirror(json) : decodeRegular(json)

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1()

const isBlank = (text: string): boolean => text.trim() === ""

export const parseOutline = (
  file: string,
  contents: string,
  claims: Claims,
): Result.Result<Outline, ReadonlyArray<OutlineError>> => {
  const nodes: Array<Located> = []
  const errors: Array<OutlineError> = []

  contents.split("\n").forEach((text, index) => {
    const line = index + 1
    if (isBlank(text)) return

    const record = readRecord(file, line, text)
    if (Result.isFailure(record)) {
      errors.push(...record.failure)
      return
    }
    const located: Located = { file, line, node: record.success }
    errors.push(...checkRecord(located))
    nodes.push(located)
  })

  return errors.length > 0
    ? Result.fail(errors)
    : Result.succeed(outlineDocument(claims, file, nodes))
}

const readRecord = (
  file: string,
  line: number,
  text: string,
): Result.Result<Node, ReadonlyArray<OutlineError>> => {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (cause) {
    return Result.fail([
      {
        code: "not-json",
        file,
        line,
        message: `this line is not JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      },
    ])
  }

  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return Result.fail([
      {
        code: "not-an-object",
        file,
        line,
        message: `every line is one node, written as a JSON object; this line is ${describe(json)}`,
      },
    ])
  }

  const decoded = decodeRecord(json as Record<string, unknown>)
  return Result.isFailure(decoded)
    ? Result.fail(
      formatIssue(decoded.failure.issue).issues.map((issue) => ({
        code: "bad-record" as const,
        file,
        line,
        message: fieldMessage(issue.path, issue.message),
      })),
    )
    : Result.succeed(decoded.success)
}

const checkRecord = ({ file, line, node }: Located): ReadonlyArray<OutlineError> => {
  const errors: Array<OutlineError> = []
  const at = (code: OutlineError["code"], message: string) =>
    errors.push({ code, file, line, message })

  if (!ID_SHAPE.test(node.id)) {
    at(
      "bad-id",
      `\`${node.id}\` is not a usable id: an id is written in the mention ` +
        `alphabet — letters, digits, \`_\`, \`-\` and \`/\` — so it can be ` +
        `named by \`@\` in a title or a note`,
    )
  }

  if (isMirror(node)) return errors

  const marks = MARKS.filter((field) => node[field] !== undefined)
  if (marks.length > 1) {
    at(
      "several-marks",
      `a node carries one mark or none — this one has ${
        marks.map((field) => `\`${field}\``).join(" and ")
      }; drop whichever is stale`,
    )
  }

  if (node.repeat !== undefined) {
    if (canonicalRepeat(node.repeat) === undefined) {
      at(
        "bad-repeat",
        `\`repeat\` is \`${node.repeat}\`, which is not a repeat rule: write ${REPEAT_GRAMMAR}`,
      )
    } else if (node.date === undefined) {
      at(
        "bad-repeat",
        `\`repeat\` is \`${node.repeat}\`, but this node has no \`date\` to repeat from — ` +
          `a rule says how often, and the date says when the next one is`,
      )
    }
  }

  for (const field of [...MARKS, "date", "created", "changed"] as const) {
    const value = node[field]
    if (typeof value === "string" && !isIsoInstant(value)) {
      at(
        "bad-date",
        `\`${field}\` is \`${value}\`, which is not an ISO date (\`2026-08-10\`) or datetime (\`2026-08-10T14:30:00Z\`)`,
      )
    }
  }

  // `new Date("2026-08-01")` is midnight UTC by spec, where the offset-local
  // spellings beside it read local, so a day-only `started` would slide a span
  // by half a day: no day arm here.
  if (
    typeof node.started === "string" &&
    !(isIsoInstant(node.started) && isIsoDatetime(node.started))
  ) {
    at(
      "bad-date",
      `\`started\` is \`${node.started}\`, which is not an ISO datetime (\`2026-08-10T14:30:00Z\`) — a span gets subtracted from it, so a day-only value will not do (and \`date\` is the field that means one)`,
    )
  }

  return errors
}


const isIsoDatetime = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)

const describe = (json: unknown): string =>
  json === null ? "null" : Array.isArray(json) ? "an array" : `a ${typeof json}`

const fieldMessage = (
  path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined,
  message: string,
): string => {
  const field = (path ?? [])
    .map((segment) =>
      typeof segment === "object" ? String(segment.key) : String(segment)
    )
    .join(".")
  if (field === "") return message.toLowerCase()
  if (message === "Missing key") return `\`${field}\` is required and missing`
  if (message === "Expected no excess property") {
    return `\`${field}\` is not a field of this format`
  }
  return `\`${field}\`: ${message.toLowerCase()}`
}


const REQUIRED = {
  regular: new Set<string>(["id", "ord", "title"]),
  mirror: new Set<string>(["id", "ord", "mirror"]),
}

const ORDER = [
  "id",
  "parent",
  "ord",
  "title",
  "mirror",
  "done",
  "cancelled",
  "doing",
  "todo",
  "started",
  "worked",
  "date",
  "repeat",
  "desc",
  "after",
  "blocks",
  "see",
  "created",
  "changed",
  "custom",
] as const



export const serializeNode = (node: Node): string => {
  const required = REQUIRED[isMirror(node) ? "mirror" : "regular"]

  const record: Record<string, unknown> = {}
  for (const field of ORDER) {
    const value = field === "custom"
      ? heldCustom((node as Record<string, unknown>)[field])
      : (node as Record<string, unknown>)[field]
    if (required.has(field) || !nothing(value)) record[field] = value
  }
  return JSON.stringify(record)
}


export const serializeOutline = (nodes: ReadonlyArray<Node>): string =>
  nodes.length === 0 ? "" : `${nodes.map(serializeNode).join("\n")}\n`

export const format: OutlineFormat = { parse: parseOutline, serialize: serializeOutline }
