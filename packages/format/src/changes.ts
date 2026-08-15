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
 * **Never a text diff.** A `.olai` diff is one enormous line per node with
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

import { isArchived, isMirror, MirrorNode, type Node, RegularNode } from "./node.ts"
import {
  canonicalKeys,
  markOf,
  type Props,
  sinceOf,
  type Status,
} from "./props.ts"

/**
 * Every field of a record that can differ between two readings, DERIVED from
 * the schemas rather than listed again.
 *
 * `id` is not one: it is what the two readings are matched BY. Everything else
 * on either shape is, and the schemas are where "what fields exist" is already
 * declared — `./node.ts` says so in as many words. A hand-kept copy is the one
 * mistake this comparison cannot survive: the next field the format grows would
 * simply never be compared, so a node whose only change was that field would
 * report as unchanged, show no row in the panel and put no line in the commit
 * body. A silent hole in the audit trail, with no test to fail.
 *
 * Declaration order is canonical order — the writer's, and the one a reader
 * sees in the file.
 */
const RECORD_FIELDS: ReadonlyArray<string> = [
  ...Object.keys(RegularNode.fields),
  ...Object.keys(MirrorNode.fields),
].filter((field, at, all) => field !== "id" && all.indexOf(field) === at)

/** A field that differs, or `file` — the one difference that is not a field of
 *  the record at all. A node's file changes when it is archived, which is the
 *  only op that moves one between outlines.
 *
 *  `Schema.String` rather than a literal union, because the members are the
 *  schemas' own field names: spelling them here would be the hand-kept list
 *  above exists to avoid, one level up. */
export const Field = Schema.String
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



/**
 * One node, as it differs between the two readings.
 *
 * `file` is where the node is NOW — and where it WAS, for one that is gone,
 * since there is nowhere else to point. Same for `title`: as it reads now, or
 * as it read on the side that still had it.
 *
 * There is deliberately no added/removed/changed tag beside `sort`. It would be
 * a function of `sort` (`created` is an arrival, `gone` is a departure,
 * everything else is neither) said in a second vocabulary, and nothing reads it:
 * the panel, the commit body and the subject all switch on `sort`.
 */
export const NodeChange = Schema.Struct({
  /** Root-relative, the same spelling every `file:line` uses. */
  file: Schema.String,
  id: Schema.String,
  title: Schema.String,
  /** Which fields differ. Empty for a node that arrived or left, where the
   *  answer would be "all of them" and mean nothing. */
  fields: Schema.Array(Field),
  sort: Sort,
})
export type NodeChange = typeof NodeChange.Type

/** One side of the comparison: each outline's records, keyed by its path. A
 *  file missing from the map is a file that side did not have. */
export type Records = ReadonlyMap<string, ReadonlyArray<Node>>

interface Placed {
  readonly file: string
  readonly node: Node
}

/**
 * What changed between two readings of the same set of files.
 *
 * Matched by ID ACROSS FILES rather than within one, so archiving reads as one
 * change to one node rather than as a removal and an unrelated arrival: the
 * subtree left `roadmap.olai` and is in `Archive.olai`, which is what
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

  for (const [file, nodes] of after) {
    for (const node of nodes) {
      const previous = was.get(node.id)
      if (previous === undefined) {
        changes.push({
          file,
          id: node.id,
          title: nameOf(node),
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
        fields,
        sort: sortOf(fields, previous, { file, node }),
      })
    }
  }

  // Only the ids the `after` side never mentioned. A node that moved file has
  // already been reported, under the file it is in now.
  for (const [file, nodes] of before) {
    for (const node of nodes) {
      if (now.has(node.id)) continue
      changes.push({
        file,
        id: node.id,
        title: nameOf(node),
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

/** Where a sort sits in the fixed priority — its position in the declaration,
 *  which IS the order. */
const rank = (sort: Sort): number => Sort.literals.indexOf(sort)

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

/**
 * What differs, field by field — and, INSIDE the map, key by key.
 *
 * `props` is not reported as one field, and that is the whole of what this
 * function had to learn. Every fact a commit message is about used to be a
 * field of its own, so "which fields differ" was already "which facts changed";
 * with one map holding all of them, a record whose date moved and a record that
 * was ticked would both answer `props` and {@link sortOf} could no longer tell
 * a scheduling from a completion. So a key that differs is reported by its own
 * NAME, which is the same word the field had — `status` where there were three
 * marks, and `date`, `see`, `after`, `blocks` unchanged.
 *
 * A user key reports itself too, and lands in {@link sortOf}'s `edited` — which
 * is the right answer for a fact olai does not read: something about the node
 * changed, and the subject says so without pretending to know what it was.
 */
const differing = (before: Placed, after: Placed): ReadonlyArray<Field> => {
  const fields: Array<Field> = []
  if (before.file !== after.file) fields.push("file")
  for (const field of RECORD_FIELDS) {
    if (field === "props") continue
    if (!same(valueOf(before.node, field), valueOf(after.node, field))) {
      fields.push(field)
    }
  }
  fields.push(...differingProps(propsOf(before.node), propsOf(after.node)))
  return fields
}

const propsOf = (node: Node): Props => (isMirror(node) ? {} : node.props ?? {})

/** The mark and its instant, asked of EITHER shape. A mirror carries neither —
 *  it is a placement, and the format gives it no field to hold one — so the
 *  answer is absence rather than a narrowing every arm above would have to
 *  repeat. */
const markAt = (node: Node): Status | undefined =>
  isMirror(node) ? undefined : markOf(node)

const sinceAt = (node: Node): string | undefined =>
  isMirror(node) ? undefined : sinceOf(node)

/** The keys whose values are not the same on both sides — in canonical order,
 *  so a change reads its keys the way the file writes them and two runs over
 *  one edit report the same list. */
const differingProps = (before: Props, after: Props): ReadonlyArray<Field> => {
  const keys = canonicalKeys({ ...before, ...after })
  return keys.filter((key) => !same(before[key], after[key]))
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

/** Whether a key says something now. `date` is set-or-absent, and the
 *  difference between putting one on and taking it off is the only thing a key
 *  NAME cannot carry. */
const set = (node: Node, key: string): boolean =>
  !isMirror(node) && node.props?.[key] !== undefined

/**
 * Which of the things that differ is the one this change is ABOUT.
 *
 * Takes BOTH sides now, where it used to take the `after` one and a list of
 * field names. The four mark arms are why: while there were three mark fields,
 * "the `done` field differs" and "`done` is still there" were between them
 * enough to tell a completion from an un-completion, because each mark had a
 * field that appeared and disappeared with it. One `status` key holds every
 * transition, so the question is what the mark WAS and what it BECAME, and both
 * sides have to be in hand to ask it.
 *
 * The four arms are the same four events in the same priority, and the
 * re-statement is exact: `done` is a record that says done now and did not say
 * exactly this before (a re-stamped instant is still a completion, which is
 * what the old rule said by watching the field's VALUE change); `undone` is one
 * that said done and no longer does; then the same pair for `doing`. A `todo`
 * appearing or going is deliberately in none of them, as it was in none of the
 * old ones — it falls to the tail, and `edited` is what a commit says about it.
 */
const sortOf = (fields: ReadonlyArray<Field>, before: Placed, after: Placed): Sort => {
  const changed = new Set(fields)
  if (changed.has("file")) {
    return isArchived(after.file) ? "archived" : "moved"
  }

  const was = markAt(before.node), now = markAt(after.node)
  const restamped = was === now && sinceAt(before.node) !== sinceAt(after.node)
  if (now === "done" && (was !== "done" || restamped)) return "done"
  if (was === "done" && now !== "done") return "undone"
  if (now === "doing" && (was !== "doing" || restamped)) return "doing"
  if (was === "doing" && now !== "doing") return "not-doing"

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
