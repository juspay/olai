/**
 * What a READ of the set asks, and what it says back.
 *
 * Data, and nothing but: there is no index in this file and no walk reachable
 * from it. It is here for the reason `./committing.ts` and `./searching.ts`
 * are, and the argument is those files' word for word — this package is the
 * floor both the ops layer and the wire spec stand on, and a vocabulary spelled
 * in either of those would have to be spelled again in the other.
 *
 * `./searching.ts` moved ONE of the four reads down here and argued it from a
 * drift that was live. These are the other three — the directory
 * (`list_outlines`), one node in full (`read_node`), and a node with everything
 * under it (`read_subtree`) — and they were **the last query answers with no
 * wire shape at all**: TypeScript interfaces in `@olai/ops`' `query.ts`, which
 * no surface can declare and no browser can be handed. They are moved BEFORE
 * anything carries them rather than after, which is the whole lesson of the
 * search case: that one was found the other way round, live on the wire, with
 * an agent reading a field the palette's encoder silently dropped
 * (docs/brainstorming/surface-mcp-positions.md, position (a)).
 *
 * **Three things this move had to get right, and all three were written down
 * before it was made** (that document, position (c)):
 *
 * *Here, and not `@olai/ops`.* The obvious phrasing — declare them in the
 * producing package and re-export from `@olai/surface` — is wrong in its
 * load-bearing half: it makes the wire spec depend on the ops layer, which is
 * the ban that made the duplication structural in the first place
 * (`packages/ops/package.json`: "`@olai/surface` is deliberately absent"). No
 * more than `CommitRequest` and `Pending` are re-exported from their producer.
 * The floor is the floor.
 *
 * *`Applied` is NOT one of them.* The ops layer's `Applied` and
 * `@olai/surface`'s are genuinely DIFFERENT types — the editor's adds `undo`
 * and drops `summary`, `sort`, `captured` and `rev` — and that narrowing is a
 * design argued at length in `packages/surface/src/edit.ts`. Two things spelled
 * once each, not one thing spelled twice, so there is nothing here for a shared
 * declaration to say. A vocabulary crossing a floor and a keyboard's answer are
 * not the same kind of value.
 *
 * *The summary is renamed on the way.* {@link OutlineSummary} arrives from
 * `@olai/ops` as `Outline`, and this package already exports an `Outline` —
 * one file's decoded nodes (`./set.ts`). Both carry `file` and both carry
 * `nodes`, where `nodes` is a node LIST on one and a COUNT on the other, so the
 * collision is the nastier kind: the shapes look compatible at a glance. A
 * rename away from a plausible bug rather than from a compile error, which is
 * why it is done here and not left to whoever meets it.
 *
 * **What stays in `@olai/ops`** is the same division `./committing.ts` and
 * `./searching.ts` keep. Every field below is a statement about records in this
 * package's own vocabulary — an id, a `file:line`, a {@link Status}, the
 * ancestor titles `ancestorsOf` walks, the mark a record stores. WHICH node a
 * read is about, which mirrors resolve to it, how far a walk descends and what
 * a broken file leaves sayable are questions about the SET, and they stay with
 * the derivations that answer them. The shape is the floor's; the walk is the
 * ops layer's.
 */

import { Schema } from "effect"

import { Progress, type Status } from "./derive.ts"
import { Marker, MARKS } from "./node.ts"

/**
 * One node, SITUATED — the shape every read of the set answers with.
 *
 * Flattened on purpose, and not a {@link Located}: a caller of a read wants the
 * node's facts beside where it lives, not a record nested under a file and a
 * line. `@olai/ops` builds one with `foundOf` and every other answer in this
 * file hangs off it — {@link Detail}, {@link Subtree}, {@link Placed}, and one
 * level up the search hit in `./searching.ts`. It is the atom of the whole read
 * vocabulary, which is why it sits at the top of the module named for that
 * vocabulary rather than inside the one named for a query.
 */
export const Found = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  /** Where a person is pointed. Relative to the served directory, 1-based. */
  file: Schema.String,
  line: Schema.Int,
  /** The mark the node carries — a mirror's being its target's, since that is
   *  what it shows. ABSENT when it carries none: nobody marked it, so it is a
   *  bullet rather than a task nobody has started. */
  status: Schema.optionalKey(Schema.Literals(MARKS)),
  /** The canonical ancestor titles, outermost first. What makes a bare title
   *  like "order" mean something in a list of strangers. */
  path: Schema.Array(Schema.String),
  /** Free cross-references this node carries, as target ids. Absent when the
   *  node has none — so a reader can traverse without a second read, and a node
   *  that does not point anywhere does not pretend to. */
  see: Schema.optionalKey(Schema.Array(Schema.String)),
  /** What this node must come AFTER, as target ids — the edges it carries
   *  itself, exactly as they are written.
   *
   *  Here for the same reason `see` is, and now for a second one: `set_after`
   *  removes a target BY ID, so a reader that could not see the list could only
   *  change it by guessing. Not the derived blockedness — what is standing in
   *  the way right now is a question about marks, and this is what the record
   *  says. */
  after: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type Found = typeof Found.Type

// ── the directory ──────────────────────────────────────────────────────

/**
 * One outline FILE, as a listing says it — a count and the titles at the top,
 * never the nodes.
 *
 * RENAMED at the move, for the reason the module header gives: `Outline` is
 * taken here and means one file's decoded NODES. This is the summary
 * `list_outlines` answers with, and the summary is what a map is: enough to
 * choose a file, nothing that would make listing a directory cost what reading
 * it does.
 */
export const OutlineSummary = Schema.Struct({
  file: Schema.String,
  /** Regular nodes in it. Mirrors are placements, not nodes, so they do not
   *  inflate the count. */
  nodes: Schema.Int,
  /** Its top-level titles, in order — what the outline is ABOUT, in the space
   *  a listing has. */
  roots: Schema.Array(Schema.String),
  /** Present, and the whole of what can be said about it, when the file did
   *  not parse: its nodes are not loaded, so it has neither count nor roots. */
  unreadable: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type OutlineSummary = typeof OutlineSummary.Type

/**
 * The whole listing, in the envelope it travels in.
 *
 * The field earns itself twice. A bare array is not a JSON object, and the MCP
 * face wraps anything that is not one under a `value` key it invented — so the
 * choice is a name that says what the list is or a name that says nothing. And
 * an envelope is where a second fact about the listing would go if the
 * directory ever grew one; an array has nowhere to put it.
 */
export const OutlineAnswer = Schema.Struct({
  outlines: Schema.Array(OutlineSummary),
})
export type OutlineAnswer = typeof OutlineAnswer.Type

// ── one node ───────────────────────────────────────────────────────────

/** Asking for one node. The whole request: a read names an id, and everything
 *  else about the answer is the set's to decide. */
export const NodeRequest = Schema.Struct({
  id: Schema.String.annotate({ description: "The node's `id`." }),
})
export type NodeRequest = typeof NodeRequest.Type

/**
 * One PLACEMENT of a node: a mirror record that shows it, and where that line
 * sits.
 *
 * Not a {@link Found} — a placement has no title, no mark and no ancestry of
 * its own; it draws the node's. What it does have is an id, and that id is the
 * only thing `remove_mirror` takes, which is why a node's own read is where the
 * placements of it are answered. A search never returns one: a mirror is a
 * second location of a node, and a hit for it would be the same node twice,
 * once at a place no write lands.
 *
 * (`./node.ts` has a private fields object of the same name, for the `id`,
 * `parent` and `ord` a RECORD carries. Different thing, one namespace apart:
 * that one is where a record sits among its siblings, this one is where a line
 * that shows a node was found. Said out loud rather than left to be noticed.)
 */
export const Placement = Schema.Struct({
  id: Schema.String,
  file: Schema.String,
  line: Schema.Int,
  /** The node it is placed under. Absent at the top level of its file. */
  parent: Schema.optionalKey(Schema.String),
})
export type Placement = typeof Placement.Type

/**
 * A placement read from the OTHER end: one row of a curated list, and the node
 * standing at it.
 *
 * {@link Placement} answers "where else is this node drawn"; this answers "what
 * is on this list" — the two halves of the same fact, from whichever end the
 * caller happens to be holding. A Now section is a node whose children are
 * placements, so without this half an agent can retire an entry it already
 * knows about and can never ask what is on the list at all.
 *
 * `shows` is the node itself, situated the way every other answer here situates
 * one — id, title, mark, `file:line`, ancestry — because that is what the list
 * is FOR: the reader wants the items, and the placement id is what lets it take
 * one off.
 */
export const Placed = Schema.Struct({
  ...Placement.fields,
  shows: Found,
})
export type Placed = typeof Placed.Type

/**
 * The mark a node stores, with what it was stamped — `status` on {@link Found}
 * says WHICH mark, and only this says when.
 *
 * A field per mark rather than a `{ mark, at }` pair, because that is how the
 * record spells it and this is the record read back: `Marker` is `./node.ts`'
 * own declaration of a mark's value (`true`, or the ISO instant), so a stamp on
 * an answer cannot be a different kind of thing from the stamp on disk.
 *
 * The `satisfies` is the closure, and it is the whole reason the three are
 * written out: a fourth {@link MARKS} entry becomes a missing key HERE, named
 * by the compiler, rather than a mark that is writable, plannable and derivable
 * everywhere and readable back nowhere.
 */
const STAMPED = {
  done: Schema.optionalKey(Marker),
  doing: Schema.optionalKey(Marker),
  todo: Schema.optionalKey(Marker),
} satisfies { readonly [M in Status]: unknown }

/** What one node's page would say, plus the record itself. */
export const Detail = Schema.Struct({
  ...Found.fields,
  ...STAMPED,
  date: Schema.optionalKey(Schema.String),
  desc: Schema.optionalKey(Schema.String),
  /** The `#topic` and `@person` tags in the title, AS WRITTEN, sigil and all —
   *  a list that dropped the character that started them could not tell a
   *  reader which of the two namespaces this node carries. */
  tags: Schema.Array(Schema.String),
  /** How many of its child tasks are done, when any of them is a task. An
   *  ANNOTATION: it decides nothing, and in particular the node's own status is
   *  `status` above whatever this says. */
  progress: Schema.optionalKey(Progress),
  children: Schema.Array(Found),
  /** Everywhere else this node is drawn — the mirrors that show it, chains
   *  included. Absent when nothing does, which is nearly every node.
   *
   *  It is here because a placement is otherwise UNFINDABLE: mirrors are left
   *  out of search and out of every child list on purpose, so without this the
   *  only id `remove_mirror` could ever be given is one the same session had
   *  just created. Asked of the node rather than answered as a node, which is
   *  the same shape every refusal about mirrors takes — a mirror is not a node,
   *  so you ask the node where it is placed. */
  mirrors: Schema.optionalKey(Schema.Array(Placement)),
  /** The placements sitting UNDER this node, in sibling order, each with the
   *  node it shows — what a curated list holds. Absent when none do.
   *
   *  `children` above is the node's own children and never a mirror, because
   *  that list is about what hangs off it; this one is about what it POINTS at,
   *  and the two are different questions with different answers. A Now section
   *  is exactly a node of the second kind: without this, "what is on Now?" is a
   *  question the ops layer could not answer at all, and the ledger it was built
   *  for is read by hand again (the 2026-08-11 review). */
  placed: Schema.optionalKey(Schema.Array(Placed)),
})
export type Detail = typeof Detail.Type

// ── a node and everything under it ─────────────────────────────────────

/** How deep an unasked-for walk goes. Here rather than beside the walk for the
 *  reason {@link DEFAULT_SEARCH_LIMIT} is beside its request: it is part of
 *  what an absent `depth` MEANS, and the sentence below quotes it — a number
 *  changed in one place would otherwise leave every agent's JSON Schema
 *  advertising the old one. */
export const DEFAULT_SUBTREE_DEPTH = 3

/** Asking for a node and what hangs off it. */
export const SubtreeRequest = Schema.Struct({
  id: Schema.String.annotate({ description: "The node to read from." }),
  depth: Schema.optionalKey(
    Schema.Number.annotate({
      description:
        `How many levels of children to include. Default ${DEFAULT_SUBTREE_DEPTH}.`,
    }),
  ),
})
export type SubtreeRequest = typeof SubtreeRequest.Type

/**
 * A node and everything under it, nested — the shape a reader draws.
 *
 * The interface is written by hand and the schema suspends into it, which is
 * the documented way to spell a genuinely recursive Effect schema. It costs
 * nothing here and would have cost something one file over: a recursive schema
 * compiles to a `$ref`, and the MCP projection inlines local refs and strips
 * the pool — which is why `add_node`'s capture is UNROLLED to a fixed depth
 * (`@olai/ops`' `NESTING`). That constraint is about a schema an agent READS as
 * JSON Schema. This one is an answer, advertised to nobody, so the recursion
 * can be honest.
 */
export interface Subtree extends Found {
  readonly date?: string | undefined
  readonly desc?: string | undefined
  readonly children: ReadonlyArray<Subtree>
  /** True when the walk stopped at the depth it was given and this node has
   *  children it did not descend into. Said out loud, because a subtree that
   *  quietly ended would read as a leaf. */
  readonly truncated?: true
}

export const Subtree = Schema.Struct({
  ...Found.fields,
  date: Schema.optionalKey(Schema.String),
  desc: Schema.optionalKey(Schema.String),
  children: Schema.Array(Schema.suspend((): Schema.Codec<Subtree> => Subtree)),
  truncated: Schema.optionalKey(Schema.Literal(true)),
})

// ── an id that is not there ────────────────────────────────────────────

/**
 * What the two per-node reads answer when the set does not hold that id.
 *
 * A VALUE and not a refusal, and the difference is deliberate: asking about a
 * node that is gone is a fair question with a true answer, so it comes back as
 * data an agent can branch on rather than as an error it has to parse. The id
 * is echoed because the answer is otherwise indistinguishable from an empty
 * one — "which id did you not find" is the whole of what there is to say.
 */
export const Missing = Schema.Struct({ missing: Schema.String })
export type Missing = typeof Missing.Type

/** What `read_node` says: the node, or the id it does not hold. */
export const NodeAnswer = Schema.Union([Detail, Missing])
export type NodeAnswer = typeof NodeAnswer.Type

/** What `read_subtree` says, and the same two arms for the same reason. */
export const SubtreeAnswer = Schema.Union([Subtree, Missing])
export type SubtreeAnswer = typeof SubtreeAnswer.Type
