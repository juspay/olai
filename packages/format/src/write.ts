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
 * Field order comes from {@link ./node.ts}'s two structs — the same file a
 * reader looks in for "what fields exist" — because a writer that kept its own
 * list is a list that drifts.
 */

import { isMirror, type Located, type Node } from "./node.ts"

/** Canonical field order for a regular node. docs/format.md's table, in its
 *  order; a mirror carries only the four below. */
const REGULAR_FIELDS = [
  "id",
  "parent",
  "ord",
  "title",
  "done",
  "doing",
  "date",
  "desc",
  "doc",
  "after",
  "blocks",
  "see",
] as const

const MIRROR_FIELDS = ["id", "parent", "ord", "mirror"] as const

/**
 * One record, as one line — no trailing newline, because who separates lines
 * is {@link serializeOutline}'s business and not this function's.
 *
 * Absent fields are OMITTED: the schema uses `optionalKey`, so a field that is
 * not there is not there, and writing `null` or `[]` in its place would be a
 * record the reader rejects.
 */
export const serializeNode = (node: Node): string => {
  const fields: ReadonlyArray<string> = isMirror(node) ? MIRROR_FIELDS : REGULAR_FIELDS
  const record: Record<string, unknown> = {}
  for (const field of fields) {
    const value = (node as Record<string, unknown>)[field]
    if (value !== undefined) record[field] = value
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
