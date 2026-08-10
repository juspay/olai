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
 * Field order comes from docs/format.md's own table — the same place a reader
 * looks for "what fields exist" — because a writer that kept its own list is a
 * list that drifts.
 *
 * The other half of "one spelling" is {@link nothing}: an optional field that
 * holds nothing is not written at all, so no writer can put `null`, `[]` or `""`
 * into a file where the format says the field is simply absent.
 */

import { isMirror, type Located, type Node } from "./node.ts"

/**
 * Canonical field order, and which fields a record must carry.
 *
 * docs/format.md's table, in its order, split by its "required" column — the
 * split is what {@link serializeNode}'s omission rule turns on, so it is
 * declared once rather than re-derived from a list of names somewhere else.
 * A mirror carries only its four (`parent` optional at top level).
 */
const REGULAR_FIELDS = {
  required: ["id", "ord", "title"],
  optional: ["parent", "done", "doing", "date", "desc", "doc", "after", "blocks", "see"],
} as const

const MIRROR_FIELDS = {
  required: ["id", "ord", "mirror"],
  optional: ["parent"],
} as const

/** The canonical ORDER, which is not the required/optional split: a reader
 *  looks for `parent` between `id` and `ord`, wherever it sits in the table
 *  above. Spelled from docs/format.md's row order. */
const ORDER = [
  "id",
  "parent",
  "ord",
  "title",
  "mirror",
  "done",
  "doing",
  "date",
  "desc",
  "doc",
  "after",
  "blocks",
  "see",
] as const

/**
 * Is this value NOTHING?
 *
 * `undefined` is how the schema spells absent, and `null`, `[]` and `""` are
 * the three ways a writer can accidentally spell it as something. All four say
 * the same thing about the node — it has no note, no edges, no date — and
 * docs/format.md's Writing section requires one spelling of that on disk:
 * "absent fields are omitted, never `null` or `[]`".
 *
 * That is not tidiness. Two files that mean the same thing must not differ
 * byte-for-byte, because the format's whole bet is that a line-based git merge
 * is safe — and `{"after":[]}` versus no `after` is a conflict about nothing.
 */
const nothing = (value: unknown): boolean =>
  value === undefined || value === null ||
  (Array.isArray(value) && value.length === 0) || value === ""

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
  const fields = isMirror(node) ? MIRROR_FIELDS : REGULAR_FIELDS
  const required: ReadonlySet<string> = new Set(fields.required)
  const known: ReadonlySet<string> = new Set([...fields.required, ...fields.optional])

  const record: Record<string, unknown> = {}
  for (const field of ORDER) {
    if (!known.has(field)) continue
    const value = (node as Record<string, unknown>)[field]
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

/**
 * One file's nodes out of a flat set, in the order they are written.
 *
 * The set is flat ({@link ./set.ts}), so "what does `pantry.jsonl` contain" is
 * a filter — and every writer needs the same one, in the same order, because a
 * write re-emits the whole file and a reordering would be a diff nobody asked
 * for. `line` is the order: the records come back in the order they were read,
 * which is the order they are on disk.
 */
export const nodesOf = (
  nodes: ReadonlyArray<Located>,
  file: string,
): ReadonlyArray<Located> =>
  nodes
    .filter((located) => located.file === file)
    .slice()
    .sort((a, b) => a.line - b.line)
