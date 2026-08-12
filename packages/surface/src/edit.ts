/**
 * Editing, on the wire: what a KEYBOARD may do to a served directory.
 *
 * The agent has a closed list of tools ({@link ../../ops/src/tools.ts}) and
 * this is the browser's, deliberately narrower and deliberately shaped like
 * the keys rather than like the ops behind them. Everything here lands as ONE
 * op through the same write gate the agent's tools go through — there is no
 * second writer — and comes back the way every other change does, on the
 * outlines collection. Nothing is echoed: a procedure answers that the write
 * landed, and what a reader sees is the file it produced.
 *
 * Three properties are worth stating because all three are decisions:
 *
 *   - **The verbs are INTENTS, and the placement is the server's.** `Tab` says
 *     "indent this", not "reparent it under the node above and put it last";
 *     `Ctrl+Enter` says "toggle done", not "set done" or "clear done". What a
 *     row's neighbours are, and what mark it carries, are facts about the
 *     snapshot — so they are read where the snapshot IS
 *     ({@link ../../server/src/edit.ts}) rather than computed from a tree a tab
 *     drew some frames ago and posted back. A browser that computed them would
 *     be a second reading of the set, free to disagree with the one the write
 *     is judged against.
 *   - **One union, one procedure** — the shape `@olai/ops` already uses for
 *     the same kind of thing (`Request` + `run`). What that buys is that the
 *     list of verbs is spelled ONCE: adding one is an arm here and an arm in
 *     the resolver, and every other site is a compile error rather than a
 *     silent hole. Five procedures were the first shape, and they were five
 *     spellings of one list — the wire, a parallel type, a client-side
 *     dispatch and a binding each.
 *   - **This is not the ops request vocabulary re-spelled.** It is smaller (no
 *     `create`, no `archive`, no `see`, no `date`, no chosen ids) and, where it
 *     differs, it differs because something is resolved behind it. Where
 *     nothing is (`title`, `desc`), it uses the ops layer's own word, so a
 *     name that differs from an op's is a name with arithmetic behind it. Ops
 *     itself learns none of this — an op does not know it is being called over
 *     a wire, which is what its own manifest says.
 *
 * THREE OF THE VERBS ARE AN UNDO'S, and they are the one place this list is
 * not shaped like a key. `place`, `mark` and `remove` say where a row SAT,
 * which mark it CARRIED and that a row this session created should go — the
 * facts a structural op destroyed, recorded at apply time
 * ({@link Applied.undo}) and replayed through this same procedure when
 * somebody presses ⌘Z. They name absolute things because that is what "put it
 * back" means; what keeps that honest is WHO NAMED THE IDS — the server
 * derived every one of them from the snapshot the original write was judged
 * against, so they are ids an agent would have named, and the replay is judged
 * against the snapshot as it is NOW. Nothing here restores a snapshot: an undo
 * is one more op at the write gate, refused like any other when the set has
 * moved somewhere the inverse cannot go.
 *
 * `remove` IS THE UN-CREATE, and it is worth being exact about what it is not:
 * it is the inverse of an `add`, bound to no key, and this list still has no
 * delete — the deferral #109 recorded (human, 2026-08-11) is still the human's
 * to close, and a delete key would be its own item with its own policy
 * (subtree? confirm?). What this verb resolves to is the ops layer's own
 * `archive` — the only removal the set has — narrowed to a node with nothing
 * under it, which is a rule about what an UNDO is entitled to rather than a
 * delete policy this surface invented. Split/merge, multi-select and drag-drop
 * are their own items, so none of them is expressible here.
 */

import { MARKS, OpFailure } from "@olai/format"
import { Schema } from "effect"

/** A node this edit is about — the record occupying a row, which for a text
 *  edit is the node the row SHOWS (a mirror has no title of its own) and for a
 *  move is the placement itself. Which of the two a caller means is decided
 *  where the row is drawn; by the time it is here it is one id. */
const Id = Schema.String

/**
 * Where a new row goes. Three places, because three is what the page offers:
 * after a row (`Enter`), under a row that has nothing beneath it yet (the first
 * child of a zoomed node), and first in an outline that holds nothing at all.
 *
 * A tagged union rather than three nullable fields: "after nothing, under
 * nothing, in this file" and "after this, under that" are both spellable with
 * nullable fields and neither means anything, and the server would have to
 * refuse them at runtime instead of the wire refusing them at decode.
 */
export const Anchor = Schema.Union([
  /** Immediately after this node, among its siblings — a new sibling. */
  Schema.Struct({ kind: Schema.Literal("after"), id: Id }),
  /** The first child of this node, which is what an empty zoomed page offers. */
  Schema.Struct({ kind: Schema.Literal("under"), id: Id }),
  /** The first row of an outline that has none. The one place a FILE is
   *  named — everywhere else the file is wherever the anchor lives, and a
   *  second answer could disagree with it. */
  Schema.Struct({ kind: Schema.Literal("first"), file: Schema.String }),
])
export type Anchor = typeof Anchor.Type

/**
 * One edit, as the wire carries it.
 *
 * Tagged by `verb`, and the four ways a row MOVES are one arm with an enum
 * rather than four arms: a move is a move, and the difference between them is
 * entirely a question about the snapshot.
 *
 *   - `in` — under the sibling above it, last among that node's children
 *     (`Tab`);
 *   - `out` — up a level, immediately after what used to be its parent
 *     (`Shift+Tab`);
 *   - `up` / `down` — swap with the sibling above or below (`Alt+Shift+↑/↓`).
 */
export const Edit = Schema.Union([
  Schema.Struct({
    verb: Schema.Literal("add"),
    at: Anchor,
    /** Verbatim, as typed. An empty one is refused by the ops layer — a node
     *  needs a title — which is why the editor holds a new row as a DRAFT
     *  until it has one rather than writing a blank and filling it in. */
    title: Schema.String,
  }),
  Schema.Struct({
    verb: Schema.Literal("move"),
    id: Id,
    how: Schema.Literals(["in", "out", "up", "down"]),
  }),
  /** Put the mark on, or take it off — whichever the node is not. The keyboard
   *  binds `done` (`Ctrl+Enter`); the field names a mark because the vocabulary
   *  is the format's own and a fourth mark should not arrive writable
   *  everywhere except here. */
  Schema.Struct({ verb: Schema.Literal("toggle"), id: Id, mark: Schema.Literals(MARKS) }),
  Schema.Struct({ verb: Schema.Literal("title"), id: Id, title: Schema.String }),
  Schema.Struct({
    verb: Schema.Literal("desc"),
    id: Id,
    /** `null` removes the note, which is what an emptied textarea means. */
    desc: Schema.NullOr(Schema.String),
  }),

  // ── the three an undo speaks ─────────────────────────────────────────

  /**
   * Put a row back where it sat — the inverse of a `move`, and the only verb
   * here that names a placement outright.
   *
   * `move` cannot express it: "out" means "after what used to be my parent",
   * which is where an indent came from and nowhere else — and it is not where
   * a row that was indented and then reordered came from. What a row leaves
   * behind is a PLACE, and a place is a parent and a neighbour.
   *
   * Nor can {@link Anchor}, which is the shape three lines of this file's own
   * argument would send a reader to: its arms are where a NEW ROW goes, and
   * both of the ones that name a container mean LAST among what is there
   * ("under" a node, "first" in an empty file). A row that was first among its
   * siblings has to come back to the front, so reusing those arms would need
   * two more with the opposite meaning inside a union about creation. It is
   * also total where an ops `move` is not: both fields are required, and
   * `null` is an answer rather than an absence.
   */
  Schema.Struct({
    verb: Schema.Literal("place"),
    id: Id,
    /** The parent it sat under — `null` for the top level of its file. */
    parent: Schema.NullOr(Id),
    /** The sibling it sat immediately AFTER — `null` when it was the first of
     *  them, which is a place a neighbour cannot name. Recorded as a NODE
     *  rather than as an index: ids survive what another writer does to the
     *  rows around them, and an index does not.
     *
     *  BOTH fields, and the second is not redundant with the first even though
     *  a sibling implies a parent: the pair is CHECKED. If that neighbour has
     *  itself moved somewhere else since, "after it" and "under that parent"
     *  stop agreeing, and the ops layer refuses the placement instead of
     *  quietly following the neighbour into a branch this row was never in.
     *  That refusal is the feature. */
    after: Schema.NullOr(Id),
  }),
  /**
   * Put a mark back — the inverse of a `toggle`.
   *
   * `null` is "it carried none", which a toggle cannot say either: the format
   * allows at most one mark, so ticking a `todo` node off does not add `done`
   * beside it, it REPLACES it. What was there is therefore something only the
   * write that displaced it knew.
   */
  Schema.Struct({
    verb: Schema.Literal("mark"),
    id: Id,
    mark: Schema.NullOr(Schema.Literals(MARKS)),
  }),
  /**
   * The UN-CREATE: take back a row that was just made, which is the inverse of
   * an `add` and the only removal this surface has. Not a delete — no key
   * sends it, and the deferral #109 recorded is not this PR's to close.
   *
   * It resolves to `archive`, because that is the only removal the SET has: a
   * node goes to `Archive.jsonl` keeping its id, which is a trash rather than
   * a shredder and is exactly what `archive_node` does for an agent.
   *
   * What the WIRE guarantees is the narrowing, and it is worth saying in those
   * terms rather than in the client's: this is `archive_node` minus every node
   * that has anything under it. That nothing but an inverse produces one today
   * is a fact about the editor, and a fact about the editor is not a fence —
   * the fence is the refusal, and it is the ops layer's rule about what an
   * undo is entitled to: what it made, never what somebody built on it.
   */
  Schema.Struct({ verb: Schema.Literal("remove"), id: Id }),
])
export type Edit = typeof Edit.Type

/**
 * What a write that LANDED says.
 *
 * The node it was about — which for `add` is the row that did not exist a
 * moment ago, and is what lets the editor follow it onto the screen — and
 * whatever the rollup noticed. The `nudge` is the ops layer's own
 * ({@link ../../ops/src/request.ts}): the last task under a parent going done,
 * a branch ticked over unfinished ones. It is advice ON A SUCCESS and never a
 * reason a write did not happen, and it travels here for the reason it travels
 * to an agent — the person who caused the write is exactly who it is for. A
 * keyboard that dropped it would be the one writer whose nudges nobody sees.
 */
export const Applied = Schema.Struct({
  id: Id,
  nudge: Schema.optionalKey(Schema.String),
  /**
   * What would TAKE THIS WRITE BACK, derived from the snapshot it was judged
   * against — the half of an undo stack a browser cannot compute for itself.
   *
   * It has to be recorded here because the facts an op destroys are gone the
   * moment it lands: where a row sat before `Tab`, which mark a `Ctrl+Enter`
   * replaced. A tab could keep its own note of them, and it would be a SECOND
   * reading of the set — some frames old, free to disagree with the one the
   * write was judged against, which is the reading whose neighbours are the
   * ones being undone.
   *
   * A LIST, in the order it must be replayed, and it is one edit for
   * everything but a mark that displaced another: putting `todo` back on a
   * node that is currently `done` is two ops, because the ops layer refuses to
   * walk finished work backwards in one (`plan.ts` — "undo that first"). Two
   * calls is exactly what an agent would make, which is what keeps the faces
   * consistent; a shortcut here would be the web doing something MCP cannot.
   *
   * ABSENT when nothing would take it back: the text edits, which the editor's
   * own draft semantics already own, and an undo that cannot be redone (a row
   * that went to the archive does not come out through `move`, which is
   * same-file by the format).
   */
  undo: Schema.optionalKey(Schema.Array(Edit)),
})
export type Applied = typeof Applied.Type

/**
 * The one procedure, and its failure channel is the half the editor is built
 * on: a refused write comes back as {@link OpFailure} — the validator's own
 * rows — so the draft it came from can be KEPT and the reason shown beside it.
 * A refusal that flattened into a transport error would be a keystroke
 * silently lost.
 */
export const editProcedures = {
  apply: { input: Edit, output: Applied, error: OpFailure },
} as const
