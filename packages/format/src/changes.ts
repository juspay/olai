/**
 * Two readings of the same outlines, in olai's words.
 *
 * PURE, and with no git in it — which is the whole reason it is here rather
 * than beside the plumbing that fetches the two sides. It is handed records and
 * answers with records; what the two sides ARE is the caller's business, and
 * there are two callers by design: what is pending is HEAD against the working
 * tree, and a past change is a commit against its parent
 * (docs/brainstorming/git-commits.md).
 *
 * **Never a text diff.** A `.jsonl` diff is one enormous line per node with
 * everything on it changing at once, which is exactly the thing this format
 * bought line-based merges with — and exactly the thing nobody can read. The
 * unit here is a NODE, and what a reader is told is what CHANGED ABOUT IT:
 * marked done, note rewritten, moved, archived.
 *
 * The model stays small because the wording is not in it. A change carries the
 * FIELDS that differ and one {@link Sort} — the single thing it is mostly about
 * — and each consumer keeps its own vocabulary for that: the panel says "marked
 * done", the commit body says `done:`. One classification, two tables, neither
 * of them here.
 */

import { Schema } from "effect"

import { isMirror, type Node } from "./node.ts"

/** Every field of a record that can differ between two readings. `id` is not
 *  one: it is what the two readings are matched BY. In canonical order, which
 *  is `./node.ts`'s. */
const RECORD_FIELDS = [
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
  "mirror",
] as const

/** A field that differs, or `file` — the one difference that is not a field of
 *  the record at all. A node's file changes when it is archived, which is the
 *  only op that moves one between outlines. */
export const Field = Schema.Literals(["file", ...RECORD_FIELDS])
export type Field = typeof Field.Type

/**
 * What a change is mostly ABOUT.
 *
 * Derived from the fields AND the values, because two of them cannot be told
 * apart by name: a `done` that appeared and a `done` that was taken off are the
 * same field and opposite events. Carried on the change so every consumer
 * classifies identically and none of them re-derives it.
 *
 * The order of this list is the FIXED PRIORITY — first match wins when several
 * things changed at once, and the same order picks the one change a composed
 * commit subject names.
 */
export const Sort = Schema.Literals([
  "created",
  "archived",
  "gone",
  "done",
  "undone",
  "doing",
  "not-doing",
  "moved",
  "scheduled",
  "unscheduled",
  "noted",
  "renamed",
  "linked",
  "edited",
])
export type Sort = typeof Sort.Type

/** The priority above, as a lookup: lower sorts first. */
const RANK: ReadonlyMap<Sort, number> = new Map(
  Sort.literals.map((sort, at) => [sort, at] as const),
)

/**
 * One node, as it differs between the two readings.
 *
 * `file` is where the node is NOW — and where it WAS, for one that is gone,
 * since there is nowhere else to point. Same for `title`: as it reads now, or
 * as it read on the side that still had it.
 */
export const NodeChange = Schema.Struct({
  /** Root-relative, the same spelling every `file:line` uses. */
  file: Schema.String,
  id: Schema.String,
  title: Schema.String,
  kind: Schema.Literals(["added", "removed", "changed"]),
  /** Empty unless `kind` is `changed`. */
  fields: Schema.Array(Field),
  sort: Sort,
})
export type NodeChange = typeof NodeChange.Type

/** One side of the comparison: each outline's records, keyed by its path. A
 *  file missing from the map is a file that side did not have. */
export type Records = ReadonlyMap<string, ReadonlyArray<Node>>

/** Where archiving puts things — the one name a cross-file move can land in,
 *  and the difference between "archived" and the "moved" nothing writes. */
const ARCHIVE = "Archive.jsonl"

interface Placed {
  readonly file: string
  readonly node: Node
}

/**
 * What changed between two readings of the same set of files.
 *
 * Matched by ID ACROSS FILES rather than within one, so archiving reads as one
 * change to one node rather than as a removal and an unrelated arrival: the
 * subtree left `roadmap.jsonl` and is in `Archive.jsonl`, which is what
 * happened. Both files are dirty in that case, so both sides are in hand.
 *
 * The answer is in file order — the `after` side's, then whatever only the
 * `before` side had — and within a file in record order, so a panel drawing it
 * reads down the outline.
 */
export const changesOf = (
  before: Records,
  after: Records,
): ReadonlyArray<NodeChange> => {
  const was = placed(before)
  const now = placed(after)

  const changes: Array<NodeChange> = []
  const seen = new Set<string>()

  for (const [file, nodes] of after) {
    for (const node of nodes) {
      seen.add(node.id)
      const previous = was.get(node.id)
      if (previous === undefined) {
        changes.push({
          file,
          id: node.id,
          title: nameOf(node),
          kind: "added",
          fields: [],
          sort: "created",
        })
        continue
      }
      const fields = differing(previous, { file, node })
      if (fields.length === 0) continue
      changes.push({
        file,
        id: node.id,
        title: nameOf(node),
        kind: "changed",
        fields,
        sort: sortOf(fields, { file, node }),
      })
    }
  }

  // Only the ids the `after` side never mentioned. A node that moved file has
  // already been reported, under the file it is in now.
  for (const [file, nodes] of before) {
    for (const node of nodes) {
      if (seen.has(node.id) || now.has(node.id)) continue
      changes.push({
        file,
        id: node.id,
        title: nameOf(node),
        kind: "removed",
        fields: [],
        sort: "gone",
      })
    }
  }

  return changes
}

/** The change a composed subject should name: the biggest by the fixed
 *  priority, and among equals the first one read. `null` for nothing. */
export const biggestOf = (
  changes: ReadonlyArray<NodeChange>,
): NodeChange | null => {
  let best: NodeChange | null = null
  for (const change of changes) {
    if (best === null || rank(change.sort) < rank(best.sort)) best = change
  }
  return best
}

const rank = (sort: Sort): number => RANK.get(sort) ?? Sort.literals.length

/** Every record of every file, by id. Ids are unique across the SET, which is
 *  what lets one map hold them all and what makes a cross-file move visible. */
const placed = (records: Records): ReadonlyMap<string, Placed> => {
  const by = new Map<string, Placed>()
  for (const [file, nodes] of records) {
    for (const node of nodes) by.set(node.id, { file, node })
  }
  return by
}

/** What to call a node. A mirror has no title of its own — it is a second
 *  placement of a node that does — so it answers by the id it was named by,
 *  the same way a `move:` line does. */
const nameOf = (node: Node): string => (isMirror(node) ? node.id : node.title)

const differing = (before: Placed, after: Placed): ReadonlyArray<Field> => {
  const fields: Array<Field> = []
  if (before.file !== after.file) fields.push("file")
  for (const field of RECORD_FIELDS) {
    if (!same(valueOf(before.node, field), valueOf(after.node, field))) {
      fields.push(field)
    }
  }
  return fields
}

type Value = string | boolean | ReadonlyArray<string> | undefined

const valueOf = (node: Node, field: (typeof RECORD_FIELDS)[number]): Value =>
  (node as Readonly<Record<string, Value>>)[field]

/** Values are strings, booleans, absent, or lists of ids — so this is the whole
 *  of the comparison, and it is shallow because the format has no depth. */
const same = (a: Value, b: Value): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, at) => entry === b[at])
  }
  return a === b
}

/** Whether a field says something now. The two marks and `date` are all
 *  set-or-absent, and the difference between putting one on and taking it off
 *  is the only thing a field NAME cannot carry. */
const set = (node: Node, field: "done" | "doing" | "date"): boolean =>
  valueOf(node, field) !== undefined

/** Which of the fields that differ is the one this change is ABOUT. Takes the
 *  `after` side because three of the arms turn on what the field BECAME, which
 *  is the one thing a field name cannot say. */
const sortOf = (fields: ReadonlyArray<Field>, after: Placed): Sort => {
  const changed = new Set(fields)
  if (changed.has("file")) {
    return base(after.file) === ARCHIVE ? "archived" : "moved"
  }
  if (changed.has("done")) return set(after.node, "done") ? "done" : "undone"
  if (changed.has("doing")) return set(after.node, "doing") ? "doing" : "not-doing"
  if (changed.has("parent") || changed.has("ord")) return "moved"
  if (changed.has("date")) return set(after.node, "date") ? "scheduled" : "unscheduled"
  if (changed.has("desc")) return "noted"
  if (changed.has("title")) return "renamed"
  if (
    changed.has("see") || changed.has("after") || changed.has("blocks") ||
    changed.has("doc") || changed.has("mirror")
  ) {
    return "linked"
  }
  return "edited"
}

const base = (file: string): string => file.slice(file.lastIndexOf("/") + 1)
