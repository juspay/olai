/**
 * The `.org` outline codec: one file's bytes into located records and back.
 *
 * Org2 (<https://github.com/aviaviavi/org2>) parses one file into headings and
 * property drawers, then each heading is handed to the existing record schema.
 * The seam is "decode per file, validate the set": everything checkable from a
 * SINGLE heading is checked here — shape, id spelling, ISO dates, at most one
 * mark — and everything that needs to know what else exists is
 * `@olai/format`'s validator. That is what lets the store re-decode one
 * changed file and keep its neighbours' results, and it is why only two
 * functions in this package can reject anything.
 *
 * A file is decoded whole or not at all: one unreadable heading and the file
 * contributes no nodes. What the SET then does about that — degrade that one
 * outline, or refuse the whole thing — is the validator's call, and so is the
 * rule that keeps this staging honest across files: a cross-file reference is
 * not reported as unknown while some file is unreadable, because "`kitchen` is
 * not a known id" is a guess when the heading declaring `kitchen` is the one
 * that failed to parse. Syntax first, then meaning; the alternative is a
 * screen of cascading errors with one real cause.
 *
 * ## Representation
 *
 * Each record is one heading with a native Org `ID` and one property drawer.
 * The heading hierarchy mirrors `parent`; JSON-encoded property values
 * preserve every OLAI scalar, collection and arbitrary Markdown string
 * exactly. The heading text is a readable FACE, not canonical data — the exact
 * title stays in `OLAI_TITLE`, and a mirror face says `mirror of <id>` — so an
 * editor's TODO keywords, tags or emphasis are never mistaken for record
 * fields. Free-standing body text and unknown properties are refused rather
 * than dropped by the next canonical write; notes belong in `OLAI_DESC`, and
 * custom application data belongs in the JSON object held by `OLAI_CUSTOM`.
 */
// Org2 0.7 ships the canonical parser as JavaScript without declaration files.
// The unsupported deep import stays quarantined to this module so the rest of
// olai has a typed boundary to replace when Org2 publishes a stable library
// export.
// @ts-expect-error — the published package has no TypeScript declarations.
import { parseOrgWithDiagnostics as parse } from "@aviaviavi/org2/dist/parser.js"
import { Result, Schema } from "effect"
import * as SchemaIssue from "effect/SchemaIssue"

import type { OutlineFormat } from "@olai/format"
import { isIsoInstant, type Claims } from "@olai/format"
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

/** The complete reversible mapping between record fields and Org properties.
 *  `ID` uses Org's native stable identity key; every other value is
 *  JSON-encoded so the one-line drawer grammar can retain arbitrary strings. */
const FIELD_PROPERTIES = {
  parent: "OLAI_PARENT",
  ord: "OLAI_ORD",
  title: "OLAI_TITLE",
  mirror: "OLAI_MIRROR",
  done: "OLAI_DONE",
  cancelled: "OLAI_CANCELLED",
  doing: "OLAI_DOING",
  todo: "OLAI_TODO",
  started: "OLAI_STARTED",
  worked: "OLAI_WORKED",
  date: "OLAI_DATE",
  repeat: "OLAI_REPEAT",
  desc: "OLAI_DESC",
  after: "OLAI_AFTER",
  blocks: "OLAI_BLOCKS",
  see: "OLAI_SEE",
  created: "OLAI_CREATED",
  changed: "OLAI_CHANGED",
  custom: "OLAI_CUSTOM",
} as const

const KIND_PROPERTY = "OLAI_KIND"

const KNOWN_PROPERTIES = new Set<string>([
  "ID",
  KIND_PROPERTY,
  ...Object.values(FIELD_PROPERTIES),
])

/** The slice of Org2's AST this codec reads, declared locally so the
 *  quarantined import above is the only untyped line in the package. */
interface Org2Diagnostic {
  readonly message: string
  readonly line: number
  readonly column: number
}

interface Org2SourceRange {
  readonly startLine: number
  readonly endLine: number
}

interface Org2Property {
  readonly key: string
  readonly value: string
}

interface Org2AstNode {
  readonly type: string
  readonly children?: ReadonlyArray<Org2AstNode>
  readonly properties?: ReadonlyArray<Org2Property>
  readonly sourceRange?: Org2SourceRange
}

interface Org2Document extends Org2AstNode {
  readonly type: "Document"
  readonly children: ReadonlyArray<Org2AstNode>
}

const parseOrgWithDiagnostics = parse as (
  input: string,
  options?: { readonly sourceRanges?: boolean },
) => {
  readonly ast: Org2Document
  readonly diagnostics: ReadonlyArray<Org2Diagnostic>
}

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

/** Which shape a drawer claims to be. `OLAI_KIND` is `mirror` or it is not;
 *  deciding here rather than letting a union try both arms is what keeps the
 *  failure message about the shape the writer meant. */
const decodeRecord = (
  json: Record<string, unknown>,
): Result.Result<Node, Schema.SchemaError> =>
  "mirror" in json ? decodeMirror(json) : decodeRegular(json)

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1()

export const parseOutline = (
  file: string,
  contents: string,
  claims: Claims,
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
        "an outline contains headings only; document-level Org content would be lost on the next write",
    })
  }

  /**
   * A heading is one record. Parentage is the Org hierarchy unless the
   * explicit OLAI_PARENT property is present. The explicit arm is what lets a
   * broken or half-edited file remain representable long enough for the
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
          message: `every heading needs exactly one property drawer; this one has ${drawers.length}`,
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
            "heading bodies are encoded in OLAI_DESC; free-standing Org content would be lost on the next write",
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
  // keystroke in some other file (`@olai/format`'s document.ts).
  return errors.length > 0
    ? Result.fail(errors)
    : Result.succeed(outlineDocument(claims, file, nodes))
}

/** One drawer back into the record the schema already judges. Values use JSON
 *  so arbitrary Markdown, newlines, arrays and custom maps remain exact while
 *  each Org property stays one physical line. */
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
      message: `property \`${KIND_PROPERTY}\` must be \`regular\` or \`mirror\``,
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

  // A repeat rule is TEXT the format itself reads, so unlike a title it has
  // to BE something — and it has to have something to repeat from. Both are
  // answerable from this one heading, which is why they are here beside "at
  // most one mark" rather than in the validator.
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
 * Records back to bytes — the other half of {@link parseOutline}, and the
 * only place olai writes the org format.
 *
 * docs/format.md's Writing rules are held here rather than by the callers:
 * canonical field order, absent fields omitted, no blank lines inside a
 * heading, exactly one trailing newline. A caller hands over records and gets
 * a whole file; it never concatenates, never joins and never appends a newline
 * of its own.
 *
 * Field order comes from docs/format.md's own table, and that list is also
 * what may be written at all — one list, walked once, so a field can be
 * forgotten in one place rather than two. Forgetting it there is what
 * write.test.ts fences, by asking the record SCHEMA which fields exist: a
 * field with no place in the order is dropped on the next write, which is a
 * writer losing data that parsed.
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
  "after",
  "blocks",
  "see",
  "created",
  "changed",
  "custom",
] as const

/**
 * One record, as one heading — no trailing newline, because who separates
 * headings is {@link serializeOutline}'s business and not this function's.
 *
 * An OPTIONAL field holding nothing is omitted, so `after: []` and no `after`
 * produce the same bytes and neither `null` nor `[]` can reach a file.
 *
 * A REQUIRED field is emitted whatever it holds, and that asymmetry is
 * deliberate: dropping one produces a drawer the reader rejects outright
 * (`property \`OLAI_TITLE\` is required`), which is strictly worse than passing
 * an odd value to the validator that is about to see it. The write gate
 * validates the whole set before any of these bytes are renamed into place, so
 * a record that should not exist is refused rather than written — but only if
 * it still SAYS what it is.
 */
const recordOf = (node: Node): Record<string, unknown> => {
  const required = REQUIRED[isMirror(node) ? "mirror" : "regular"]

  const record: Record<string, unknown> = {}
  for (const field of ORDER) {
    const value = field === "custom"
      ? heldCustom((node as Record<string, unknown>)[field])
      : (node as Record<string, unknown>)[field]
    if (required.has(field) || !nothing(value)) record[field] = value
  }
  return record
}

/** A safe one-line face for the heading. The exact source title remains in
 *  OLAI_TITLE, so Org TODO words, tags, emphasis and embedded newlines may be
 *  rendered without being mistaken for canonical OLAI data. */
const headingFace = (node: Node): string => {
  const value = isMirror(node) ? `mirror of ${node.mirror}` : node.title
  const display = value
    .replace(/\r\n?|\n/g, " ↩ ")
    // Keep hostile bytes out of Org's structural heading line. The exact
    // title below remains JSON-escaped in OLAI_TITLE and round-trips intact.
    .replace(/[\u0000-\u001f\u007f]/g, "�")
    .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "�")
  const oneLine = display.trim()
  return oneLine === "" ? "(untitled)" : oneLine
}

const serializeNodeAt = (node: Node, level: number): string => {
  const record = recordOf(node)
  const lines = [
    `${"*".repeat(level)} ${headingFace(node)}`,
    ":PROPERTIES:",
    `:ID: ${node.id}`,
    `:${KIND_PROPERTY}: ${isMirror(node) ? "mirror" : "regular"}`,
  ]
  for (const field of ORDER) {
    if (field === "id") continue
    const value = record[field]
    if (value === undefined) continue
    lines.push(`:${FIELD_PROPERTIES[field]}: ${JSON.stringify(value)}`)
  }
  lines.push(":END:")
  return lines.join("\n")
}

/** One standalone heading. Whole-file callers use {@link serializeOutline},
 *  which supplies the actual hierarchy. */
export const serializeNode = (node: Node): string => serializeNodeAt(node, 1)

/**
 * A whole outline file: one heading per record, exactly one trailing newline.
 *
 * An EMPTY set of nodes is an empty file, not a file holding one blank line —
 * a lone `\n` would be a blank line a reader tolerates and a writer must not
 * emit.
 */
export const serializeOutline = (nodes: ReadonlyArray<Node>): string =>
  nodes.length === 0 ? "" : `${hierarchyOf(nodes).join("\n\n")}\n`

/** The level a record's heading draws at: 1 at the top, one star per ancestor
 *  BELOW it. Records come out in the array's own order — canonical bytes are a
 *  function of the records handed over, and a read of what was written returns
 *  exactly what was written. Parentage itself is carried by the explicit
 *  OLAI_PARENT property, so a half-edited file whose headings nest wrong still
 *  parses to the same records for the validator to name. Broken, orphaned and
 *  cyclic chains bottom out at level 1 with their explicit OLAI_PARENT
 *  intact, for the read gate to refuse rather than a serializer silently
 *  repairing or dropping them. */
const hierarchyOf = (nodes: ReadonlyArray<Node>): ReadonlyArray<string> => {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const depth = new Map<string, number>()
  const visiting = new Set<string>()
  const levelOf = (node: Node): number => {
    const held = depth.get(node.id)
    if (held !== undefined) return held
    if (visiting.has(node.id) || node.parent === undefined || !byId.has(node.parent) || node.parent === node.id) {
      depth.set(node.id, 1)
      return 1
    }
    visiting.add(node.id)
    const level = 1 + levelOf(byId.get(node.parent)!)
    visiting.delete(node.id)
    depth.set(node.id, level)
    return level
  }
  return nodes.map((node) => serializeNodeAt(node, levelOf(node)))
}

export const format: OutlineFormat = { parse: parseOutline, serialize: serializeOutline }
