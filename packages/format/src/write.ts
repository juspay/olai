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
 */

import { type Custom, type CustomValue, customKeys } from "./custom.ts"
import { isMirror, type Located, type Node } from "./node.ts"

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
  "doing",
  "todo",
  "date",
  "desc",
  "doc",
  "after",
  "blocks",
  "see",
  "custom",
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
 *
 * Exported INSIDE the package because `has:` in the query grammar
 * (./filter.ts) asks the same question from the other end — "does this record
 * carry a note at all" — and a second answer to it would let a `desc` of `""`
 * be a note to search for and no note to write.
 */
export const nothing = (value: unknown): boolean =>
  value === undefined || value === null ||
  (Array.isArray(value) && value.length === 0) || value === "" ||
  // ...and an EMPTY MAP, which is the same rule one level in: a node whose last
  // custom key was removed carries no `custom` field rather than `{}`, or the
  // `{"after":[]}` conflict-about-nothing would simply have moved.
  (typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.keys(value).length === 0)

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
      ? tidy((node as Record<string, unknown>)[field])
      : (node as Record<string, unknown>)[field]
    if (required.has(field) || !nothing(value)) record[field] = value
  }
  return JSON.stringify(record)
}

/**
 * The `custom` map as it is written: canonical key order, and no key holding
 * nothing.
 *
 * The one field whose VALUE has an inside, so the two rules above it — one
 * spelling of absence, one spelling of a record — have to be applied one level
 * in as well. A key holding `""` says exactly what a key that is not there
 * says, and a map that came back from JSON in whatever order somebody's editor
 * left it would make two equal files differ byte for byte.
 *
 * Pruned BEFORE the emptiness test above, which is the order that matters: a
 * map whose every key held nothing must not reach disk as `{"custom":{}}`.
 */
const tidy = (value: unknown): unknown => {
  if (value === undefined || value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value
  const custom = value as Custom
  const out: Record<string, CustomValue> = {}
  for (const key of customKeys(custom)) {
    const held = custom[key]
    if (held !== undefined && !nothing(held)) out[key] = held
  }
  return out
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
 * The set is flat ({@link ./set.ts}), so "what does `pantry.olai` contain" is
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
