/**
 * Phase one of the codec: one file's bytes into located records.
 *
 * There is no parser to write. A line is `JSON.parse`d and handed to the
 * record schema; what comes back is either a node or an error naming the line
 * it came from. The seam is "parse per line, validate the set": everything
 * checkable from a SINGLE line is checked here — shape, id spelling, ISO
 * dates, at most one mark — and everything that needs to know what
 * else exists is {@link ./validate.ts}. That is what lets the store re-decode
 * one changed file and keep its neighbours' results, and it is why
 * only two functions in this package can reject anything.
 *
 * A file is decoded whole or not at all: one unreadable line and the file
 * contributes no nodes. What the SET then does about that — degrade that one
 * outline, or refuse the whole thing — is {@link ./validate.ts}'s call, and so
 * is the rule that keeps this staging honest across files: a cross-file
 * reference is not reported as unknown while some file is unreadable, because
 * "`kitchen` is not a known id" is a guess when the line declaring `kitchen` is
 * the one that failed to parse. Syntax first, then meaning; the alternative is
 * a screen of cascading errors with one real cause.
 */
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
  // Every issue, not the first: a record with three wrong fields should cost
  // one edit, not three loads.
  errors: "all",
  // A field this format does not define is a typo or a stale writer, and
  // silently dropping it would make the file and the view disagree. On a
  // mirror this is also what refuses a `title` or a `date`: those fields
  // belong on the node it points at.
  onExcessProperty: "error",
} as const

const decodeRegular = Schema.decodeUnknownResult(RegularNode, options)
const decodeMirror = Schema.decodeUnknownResult(MirrorNode, options)

/** Which shape a line claims to be. `mirror` is present or it is not; deciding
 *  here rather than letting a union try both arms is what keeps the failure
 *  message about the shape the writer meant. */
const decodeRecord = (
  json: Record<string, unknown>,
): Result.Result<Node, Schema.SchemaError> =>
  "mirror" in json ? decodeMirror(json) : decodeRegular(json)

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1()

/** Readers tolerate blank lines (writers never emit them), so a blank line is
 *  skipped rather than reported — but the line counter does not skip, because
 *  `file:line` has to match what an editor shows. */
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

  // The FACE is built here rather than at the assembly, which is the whole of
  // where PR 2 put that walk: a decode is what the store caches per file per
  // change, so what a file SAYS — its title, the addresses it points at, the
  // tags it writes — is read once when its bytes are, and never again for a
  // keystroke in some other file (`./document.ts`).
  return errors.length > 0
    ? Result.fail(errors)
    : Result.succeed(outlineDocument(claims, file, nodes))
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

  // A mirror carries no fields of its own, so the rules below have nothing to
  // ask it. The schema already refused any it should not have.
  if (isMirror(node)) return errors

  // At most ONE of the three marks. They are the states of one thing — how
  // far along a task is — so a record carrying two says two things about the
  // same question, and there is no rule for which of them wins.
  const marks = MARKS.filter((field) => node[field] !== undefined)
  if (marks.length > 1) {
    at(
      "several-marks",
      `a node carries one mark or none — this one has ${
        marks.map((field) => `\`${field}\``).join(" and ")
      }; drop whichever is stale`,
    )
  }

  // A repeat rule is TEXT the format itself reads (./repeat.ts), so unlike a
  // title it has to BE something — and it has to have something to repeat
  // from. Both are answerable from this one line, which is why they are here
  // beside "at most one mark" rather than in the validator.
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

  // `started` asks for MORE than the loop's shape check: it is SUBTRACTED
  // from the settling instant, so both ends of the subtraction must read the
  // same kind of instant — and a day-only value is UTC by spec where every
  // other datetime spelling here reads local (the rule `dates.ts`'s calendar
  // module argues: `new Date("2026-08-01")` is midnight UTC, which is the
  // previous day for half the world). One arm day-only, another offset-local,
  // and a span slides by half a day — so the field has no day arm at all.
  // ISO in shape AND clock in content.
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


/** An INSTANT with its clock, as a SHAPE — `started`'s requirement ON TOP of
 *  `isIsoInstant`'s: minutes at least, a zone spelled out or `Z`. Shape alone
 *  would be this field's two checks done, except shape is not a date:
 *  `2026-02-30T10:00:00Z` passes a regex and rolls a clock to March, so the
 *  validator is the conjunction — the one calendar answer, kept; the stricter
 *  spelling, added. */
const isIsoDatetime = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)

const describe = (json: unknown): string =>
  json === null ? "null" : Array.isArray(json) ? "an array" : `a ${typeof json}`

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

/**
 * Records back to bytes — the other half of {@link ./parse.ts}, and the only
 * place in olai that writes the format.
 *
 * docs/format.md's Writing section is four rules, and all four are held here
 * rather than by the callers: canonical field order, absent fields omitted
 * (never `null`, never `[]`), no blank lines, exactly one trailing newline.
 * A caller hands over records and gets a whole file; it never concatenates,
 * never joins and never appends a newline of its own.
 *
 * That last sentence is the lesson of 2026-08-09, when a writer that built its
 * own bytes produced two records glued onto one line — a file no reader could
 * parse, out of a write every layer above believed had succeeded. The shape
 * here is what makes that unrepresentable: {@link serializeOutline} takes the
 * records and owns every separator, so there is no seam a caller could get
 * wrong, and {@link serializeNode} can only ever produce a single line because
 * `JSON.stringify` of a record with no raw newlines in it is one (a `desc`'s
 * embedded newlines are escaped by JSON itself, which is the whole reason the
 * format is JSONL).
 *
 * Field order comes from docs/format.md's own table, and that list is also
 * what may be written at all — one list, walked once, so a field can be
 * forgotten in one place rather than two. Forgetting it there is what
 * write.test.ts fences, by asking the record SCHEMA which fields exist: a
 * field with no place in the order is dropped on the next write, which is a
 * writer losing data that parsed.
 *
 * The other half of "one spelling" is {@link nothing}: an optional field that
 * holds nothing is not written at all, so no writer can put `null`, `[]` or `""`
 * into a file where the format says the field is simply absent.
 *
 * THAT HALF OUTGREW "writing", and the header should say so rather than leave
 * a reader to discover it. {@link nothing} and {@link heldCustom} — the same
 * rule for the one field with an inside — are what "absent" MEANS in this
 * format, and three readers ask them: this file, so nothing absent reaches a
 * file; `./filter.ts`, so `has:` and `prop:` do not find what a file would not
 * hold; and `@olai/ops`, so an ANSWER leaves out exactly what the line on disk
 * leaves out. They are the only things here on the package's surface, and they
 * are on it because a second copy of the rule is how a value becomes a thing to
 * search for and no thing to write.
 */


/**
 * Which fields a record must carry WHATEVER it holds — docs/format.md's
 * table, split by its "required" column. That split is a rule about meaning
 * rather than about shape (see {@link serializeNode}'s asymmetry), so it is
 * spelled here; everything else is optional and omitted when it holds nothing.
 *
 * There is deliberately no second list of which fields a record MAY carry.
 * {@link ORDER} is that list — the loop walks it — so one list decides both
 * what is written and in what order, and a field can be forgotten in exactly
 * one place instead of two.
 */
const REQUIRED = {
  regular: new Set<string>(["id", "ord", "title"]),
  mirror: new Set<string>(["id", "ord", "mirror"]),
}

/** The canonical ORDER, which is not the required/optional split: a reader
 *  looks for `parent` between `id` and `ord`, wherever it sits in the table
 *  above. Spelled from docs/format.md's row order rather than taken from the
 *  schema's declaration order — the order of fields in a file is a contract,
 *  so it is written where the contract is rather than falling out of the order
 *  somebody happened to declare a struct in. Both record shapes share this one
 *  list: a field belonging to the other shape is absent on this record, so it
 *  is omitted for holding nothing, and only its own required fields survive
 *  that. A field the SCHEMA has and this list does not is a test failure
 *  (`write.test.ts`), because it would otherwise never reach disk at all. */
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
  "doc",
  "after",
  "blocks",
  "see",
  "created",
  "changed",
  "custom",
] as const



/**
 * One record, as one line — no trailing newline, because who separates lines
 * is {@link serializeOutline}'s business and not this function's.
 *
 * An OPTIONAL field holding nothing is omitted, so `after: []` and no `after`
 * produce the same bytes and neither `null` nor `[]` can reach a file.
 *
 * A REQUIRED field is emitted whatever it holds, and that asymmetry is
 * deliberate: dropping one produces a line the reader rejects outright
 * (`\`title\` is required and missing`), which is strictly worse than passing an
 * odd value to the validator that is about to see it. The write gate validates
 * the whole set before any of these bytes are renamed into place, so a record
 * that should not exist is refused rather than written — but only if it still
 * SAYS what it is.
 */
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


/**
 * A whole outline file: one record per line, exactly one trailing newline.
 *
 * An EMPTY set of nodes is an empty file, not a file holding one blank line —
 * a lone `\n` would be a blank line a reader tolerates and a writer must not
 * emit.
 */
export const serializeOutline = (nodes: ReadonlyArray<Node>): string =>
  nodes.length === 0 ? "" : `${nodes.map(serializeNode).join("\n")}\n`

export const format: OutlineFormat = { parse: parseOutline, serialize: serializeOutline }
