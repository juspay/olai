/**
 * Phase one of the codec: one file's bytes into located records.
 *
 * Org2 parses one file into headings and property drawers, then each heading
 * is handed to the existing record schema. The seam remains "decode per file,
 * validate the set": everything checkable from a SINGLE heading is checked
 * here — shape, id spelling, ISO
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

import {
  type Org2AstNode,
  type Org2Property,
  parseOrgWithDiagnostics,
} from "./org2-parser.ts"
import { Result, Schema } from "effect"
import * as SchemaIssue from "effect/SchemaIssue"

import { type Outline, outlineDocument } from "./document.ts"
import type { OutlineError } from "./errors.ts"
import {
  ID_SHAPE,
  isMirror,
  type Located,
  MARKS,
  MirrorNode,
  type Node,
  RegularNode,
} from "./node.ts"
import { FIELD_PROPERTIES, KIND_PROPERTY, KNOWN_PROPERTIES } from "./org2.ts"
import { canonicalRepeat, REPEAT_GRAMMAR } from "./repeat.ts"

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

export const parseOutline = (
  file: string,
  contents: string,
): Result.Result<Outline, ReadonlyArray<OutlineError>> => {
  const nodes: Array<Located> = []
  const errors: Array<OutlineError> = []

  const parsed = parseOrgWithDiagnostics(contents, { sourceRanges: true })
  for (const diagnostic of parsed.diagnostics) {
    errors.push({
      code: "bad-record",
      file,
      line: diagnostic.line,
      message: `Org2 could not parse this outline at column ${diagnostic.column}: ${diagnostic.message}`,
    })
  }

  for (const child of parsed.ast.children) {
    if (child.type === "Headline") continue
    errors.push({
      code: "bad-record",
      file,
      line: child.sourceRange?.startLine ?? 1,
      message:
        "an OLAI outline contains headings only; document-level Org content would be lost on the next OLAI write",
    })
  }

  /**
   * A heading is one OLAI record. Parentage is the Org hierarchy unless the
   * explicit OLAI_PARENT property is present. The explicit arm is what lets a
   * broken or half-edited file remain representable long enough for OLAI's
   * whole-set validator to name the real problem instead of the serializer
   * silently repairing it.
   */
  const visit = (children: ReadonlyArray<Org2AstNode>, structuralParent?: string): void => {
    for (const child of children) {
      if (child.type !== "Headline") continue

      const line = child.sourceRange?.startLine ?? 1
      const drawers = (child.children ?? []).filter((one) => one.type === "PropertyDrawer")
      if (drawers.length !== 1) {
        errors.push({
          code: "bad-record",
          file,
          line,
          message: `every OLAI heading needs exactly one property drawer; this one has ${drawers.length}`,
        })
      }

      const properties = drawers[0]?.properties ?? []
      const record = recordFromProperties(file, line, properties, structuralParent)
      let parentForChildren = structuralParent
      if (Result.isFailure(record)) {
        errors.push(...record.failure)
      } else {
        const located: Located = { file, line, node: record.success }
        errors.push(...checkRecord(located))
        nodes.push(located)
        parentForChildren = record.success.id
      }

      const unexpected = (child.children ?? []).filter(
        (one) => one.type !== "PropertyDrawer" && one.type !== "Headline",
      )
      for (const one of unexpected) {
        errors.push({
          code: "bad-record",
          file,
          line: one.sourceRange?.startLine ?? line,
          message:
            "OLAI heading bodies are encoded in OLAI_DESC; free-standing Org content would be lost on the next OLAI write",
        })
      }

      visit(child.children ?? [], parentForChildren)
    }
  }

  visit(parsed.ast.children)

  // The FACE is built here rather than at the assembly, which is the whole of
  // where PR 2 put that walk: a decode is what the store caches per file per
  // change, so what a file SAYS — its title, the addresses it points at, the
  // tags it writes — is read once when its bytes are, and never again for a
  // keystroke in some other file (`./document.ts`).
  return errors.length > 0
    ? Result.fail(errors)
    : Result.succeed(outlineDocument(file, nodes))
}

/** One drawer back into the record the schema already judges. Values use JSON
 * so arbitrary Markdown, newlines, arrays and custom maps remain exact while
 * each Org property stays one physical line. */
const recordFromProperties = (
  file: string,
  line: number,
  properties: ReadonlyArray<Org2Property>,
  structuralParent?: string,
): Result.Result<Node, ReadonlyArray<OutlineError>> => {
  const errors: Array<OutlineError> = []
  const values = new Map<string, string>()
  for (const property of properties) {
    if (values.has(property.key)) {
      errors.push({
        code: "bad-record",
        file,
        line,
        message: `property \`${property.key}\` appears more than once`,
      })
      continue
    }
    values.set(property.key, property.value)
    if (!KNOWN_PROPERTIES.has(property.key)) {
      errors.push({
        code: "bad-record",
        file,
        line,
        message:
          `property \`${property.key}\` is not an OLAI record field; use OLAI_CUSTOM for application properties`,
      })
    }
  }

  const id = values.get("ID")
  if (id === undefined || id === "") {
    errors.push({ code: "bad-record", file, line, message: "property `ID` is required" })
  }

  const kind = values.get(KIND_PROPERTY)
  if (kind !== "regular" && kind !== "mirror") {
    errors.push({
      code: "bad-record",
      file,
      line,
      message: "property `OLAI_KIND` must be `regular` or `mirror`",
    })
  }

  const json: Record<string, unknown> = { id }
  for (const [field, property] of Object.entries(FIELD_PROPERTIES)) {
    const raw = values.get(property)
    if (raw === undefined) continue
    try {
      json[field] = JSON.parse(raw)
    } catch (cause) {
      errors.push({
        code: "bad-record",
        file,
        line,
        message:
          `property \`${property}\` is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      })
    }
  }
  if (!("parent" in json) && structuralParent !== undefined) json["parent"] = structuralParent

  if (kind === "regular" && !("title" in json)) {
    errors.push({ code: "bad-record", file, line, message: "property `OLAI_TITLE` is required" })
  }
  if (kind === "mirror" && !("mirror" in json)) {
    errors.push({ code: "bad-record", file, line, message: "property `OLAI_MIRROR` is required" })
  }

  if (errors.length > 0) return Result.fail(errors)

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

/**
 * ISO dates are validated by hand rather than parsed into a date type, because
 * the stored text is written back verbatim: a date-only `2026-08-10` that
 * round-tripped through an instant would come back as a datetime, and the
 * format's stability rests on writers reproducing what they read. So the check
 * is shape plus calendar reality — `2026-02-30` matches the shape and is still
 * not a day.
 *
 * EXPORTED, though the rest of this file's spellings are not (`./index.ts`'s
 * closing paragraph: "the id regex, the edge-field list, the path resolver are
 * not contract"). This one is, and the difference is that a second reader has
 * appeared with the same question and no field to ask it about. A `date` field
 * is checked here and drawn as a badge; a CUSTOM key holding `2026-08-31` is a
 * date the format gives no meaning to and a drawer still wants to wear the
 * badge for (`@olai/web`'s `props/door.ts`). Two answers to "is this text a
 * date" would be a value the validator refuses on one field and a view calls a
 * date on another — so there is one, and it is the one the validator spends.
 */
export const isIsoInstant = (value: string): boolean => {
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

/** An INSTANT with its clock, as a SHAPE — `started`'s requirement ON TOP of
 *  `isIsoInstant`'s: minutes at least, a zone spelled out or `Z`. Shape alone
 *  would be this field's two checks done, except shape is not a date:
 *  `2026-02-30T10:00:00Z` passes a regex and rolls a clock to March, so the
 *  validator is the conjunction — the one calendar answer, kept; the stricter
 *  spelling, added. */
const isIsoDatetime = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value)

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
