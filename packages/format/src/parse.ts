/**
 * Phase one of the codec: one file's bytes into located records.
 *
 * There is no parser to write. A line is `JSON.parse`d and handed to the
 * record schema; what comes back is either a node or an error naming the line
 * it came from. The seam is "parse per line, validate the set": everything
 * checkable from a SINGLE line is checked here — shape, id spelling, ISO
 * dates, the two exclusivity rules — and everything that needs to know what
 * else exists is {@link ./validate.ts}. That is what lets the store re-decode
 * one changed file and keep its neighbours' results (phase 3), and it is why
 * only two functions in this package can reject anything.
 *
 * A file is decoded whole or not at all. A file with one unreadable line
 * contributes no nodes, and the set-wide checks do not run until every file
 * parses — because "`kitchen` is not a known id" is a guess when the line
 * declaring `kitchen` is the one that failed to parse. Syntax first, then
 * meaning; the alternative is a screen of cascading errors with one real cause.
 */

import { Result, Schema } from "effect"
import * as SchemaIssue from "effect/SchemaIssue"

import type { OutlineError } from "./errors.ts"
import { ID_SHAPE, type Located, MIRROR_FIELDS, Node } from "./node.ts"
import type { Outline } from "./set.ts"

const decodeRecord = Schema.decodeUnknownResult(Node, {
  // Every issue, not the first: a record with three wrong fields should cost
  // one edit, not three loads.
  errors: "all",
  // A field this format does not define is a typo or a stale writer, and
  // silently dropping it would make the file and the view disagree.
  onExcessProperty: "error",
})

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1()

/** Readers tolerate blank lines (writers never emit them), so a blank line is
 *  skipped rather than reported — but the line counter does not skip, because
 *  `file:line` has to match what an editor shows. */
const isBlank = (text: string): boolean => text.trim() === ""

export const parseOutline = (
  file: string,
  contents: string,
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
    : Result.succeed({ file, nodes })
}

/** JSON, then shape. */
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

  // `JSON.parse` is happy with `3`, `"x"` and `[…]`. Saying which of those it
  // got beats the schema's "Expected object" for the paste-a-JSON-array
  // mistake, which is the one people actually make.
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

  const decoded = decodeRecord(json)
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

/** The rules a single record answers on its own. Anything here that needed a
 *  second record would belong in the validator instead. */
const checkRecord = ({ file, line, node }: Located): ReadonlyArray<OutlineError> => {
  const errors: Array<OutlineError> = []
  const at = (code: OutlineError["code"], message: string) =>
    errors.push({ code, file, line, message })

  if (!ID_SHAPE.test(node.id)) {
    at(
      "bad-id",
      `\`${node.id}\` is not a usable id: ids are slugs of letters, digits, \`_\` and \`-\``,
    )
  }

  if (node.mirror !== undefined) {
    // A mirror is a placement of a node that already exists, so any field
    // describing the node itself has an authoritative copy at the target and a
    // second one here could only ever disagree with it.
    const extra = Object.keys(node).filter((field) => !MIRROR_FIELDS.has(field))
    if (extra.length > 0) {
      at(
        "bad-record",
        `a mirror carries only \`id\`, \`parent\`, \`ord\` and \`mirror\`; ${list(extra.map(quote))} belong${extra.length === 1 ? "s" : ""} on the node it mirrors (\`${node.mirror}\`)`,
      )
    }
  } else if (node.title === undefined) {
    at("bad-record", "`title` is required and missing")
  }

  if (node.done !== undefined && node.doing !== undefined) {
    at(
      "done-and-doing",
      "a node is `done` or `doing`, never both; drop whichever is stale",
    )
  }

  for (const field of ["done", "doing", "date"] as const) {
    const value = node[field]
    if (typeof value === "string" && !isIsoInstant(value)) {
      at(
        "bad-date",
        `\`${field}\` is \`${value}\`, which is not an ISO date (\`2026-08-10\`) or datetime (\`2026-08-10T14:30:00Z\`)`,
      )
    }
  }

  return errors
}

/** ISO dates are validated by hand rather than parsed into a date type,
 *  because the stored text is written back verbatim: a date-only `2026-08-10`
 *  that round-tripped through an instant would come back as a datetime, and
 *  the format's stability rests on writers reproducing what they read. So the
 *  check is shape plus calendar reality — `2026-02-30` matches the shape and
 *  is still not a day. */
const isIsoInstant = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/
    .exec(value)
  if (match === null) return false
  const [, year, month, day] = match as unknown as [string, string, string, string]
  const utc = new Date(`${year}-${month}-${day}T00:00:00Z`)
  return (
    !Number.isNaN(utc.getTime()) &&
    utc.getUTCMonth() + 1 === Number(month) &&
    utc.getUTCDate() === Number(day)
  )
}

const describe = (json: unknown): string =>
  json === null ? "null" : Array.isArray(json) ? "an array" : `a ${typeof json}`

const quote = (field: string): string => `\`${field}\``

const list = (items: ReadonlyArray<string>): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`

/** The schema's issue, re-said as a sentence about a field. Its own wording
 *  ("Expected string", "Missing key") is accurate but headless; the field name
 *  is the part a person needs. */
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
