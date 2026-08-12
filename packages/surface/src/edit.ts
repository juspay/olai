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
 *     `create`, no `see`, no `after`, no `mirror`, no chosen ids) and, where it
 *     differs, it differs because something is resolved behind it. Where
 *     nothing is (`title`, `desc`, `date`, `archive`, `unmirror`), it uses the
 *     ops layer's own word, so a name that differs from an op's is a name with
 *     arithmetic behind it. Ops itself learns none of this — an op does not
 *     know it is being called over a wire, which is what its own manifest says.
 *
 * FOUR OF THE VERBS ARE THE MENU'S, and they are here for a rule rather than
 * for a feature: "MCP and Web ops must be consistent; never deviate"
 * (HACKING.md). An agent could mark a node `todo`, clear a date, retire a
 * placement and archive a subtree, and a person at the same directory could do
 * none of those — a standing deviation (`editor-op-parity`), not editor growth.
 * `mark`, `date`, `unmirror` and `archive` close it for the ops that already
 * exist on the other face. Nothing new is invented down there: every one of
 * them resolves to the request `set_todo` / `set_date` / `remove_mirror` /
 * `archive_node` would have sent, judged by the same planner, refused in the
 * same words.
 *
 * What is deliberately ABSENT is still a DELETE, and `archive` is not one: it
 * is the ops layer's own put-away — the subtree goes to `Archive.jsonl` with
 * its ids kept, so a mirror or an `after` that named it goes on resolving —
 * and the human ruled it may take a subtree, WITH a confirm naming what goes
 * (2026-08-12). A key that erases a branch is still not spellable here.
 * Split/merge, multi-select and drag-drop are their own items too, so none of
 * them is expressible here.
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

  // ── the four the ••• menu speaks ─────────────────────────────────────

  /**
   * The mark this node should CARRY — named outright, where `toggle` names one
   * and lets the server read which way it goes.
   *
   * Both, rather than one, because they are two different intents and only one
   * of them is a question about the snapshot. `Ctrl+Enter` means "tick this
   * off, or un-tick it" and cannot say which without reading the stored mark;
   * a menu entry means "this node is doing now", whatever it was a moment ago
   * — and it was chosen from a list drawn beside the mark it is replacing. A
   * menu built on `toggle` would have to ask for `done` to reach `todo` and
   * hope nobody else wrote in between.
   *
   * `null` is "carrying none", which a toggle cannot say either: the format
   * allows AT MOST ONE mark, so taking a mark off is not the absence of
   * putting one on. Which op that becomes is the resolver's
   * ({@link ../../server/src/edit.ts}) — the mark's own op, or the stored
   * mark's with `undo` — because "what is on it now" is a fact about the set.
   */
  Schema.Struct({
    verb: Schema.Literal("mark"),
    id: Id,
    mark: Schema.NullOr(Schema.Literals(MARKS)),
  }),
  /**
   * The scheduling date, set or cleared — `set_date`'s own reach, spelled the
   * way {@link Applied} spells `desc`, because nothing is resolved behind it.
   *
   * The menu sends only `null` today: CLEARING is the half of this that has
   * nowhere else to live, and putting a date ON one belongs to the `!` picker
   * (`input-widgets`), which is a typing affordance rather than a menu entry.
   * The field is nonetheless the op's full one, and that is the point of this
   * verb existing at all — the deviation being closed is "MCP can change a
   * node's date and a person cannot", so the wire says what the op says and
   * the UI arrives at its own pace. It is also what lets an undo put a cleared
   * date back, which a clear-only verb could not spell.
   */
  Schema.Struct({
    verb: Schema.Literal("date"),
    id: Id,
    /** `null` clears it, which is the only value a menu sends. */
    date: Schema.NullOr(Schema.String),
  }),
  /**
   * Retire ONE placement: the row goes, the node it shows and every other
   * placement of it stay.
   *
   * `id` is the MIRROR record's — the row's own id, never the id of what it
   * draws — which is the same distinction a `move` makes and the opposite of
   * every text edit here. The menu can only offer it on a mirror row, so the
   * caller has one id and it is the right one; what happens when something
   * else still names that placement is the ops layer's to refuse, in its own
   * words, exactly as it refuses `remove_mirror`.
   */
  Schema.Struct({ verb: Schema.Literal("unmirror"), id: Id }),
  /**
   * Put a node and everything under it away — `archive_node`, from the menu.
   *
   * A TRASH, not a shredder: the subtree moves to `Archive.jsonl` under a
   * scaffold of its ancestors' titles, keeping every id, so a mirror, an
   * `after` or a `see` that named any of it goes on resolving. It is one op —
   * the subtree is the op's unit, not this verb's arithmetic — and the fence
   * around it is not on the wire at all: it is the CONFIRM the menu asks
   * first, naming how many rows go with it (human, 2026-08-12). A fence in
   * this schema would be a rule an agent's `archive_node` does not have, which
   * is the deviation read backwards.
   *
   * IT DOES NOT COME BACK YET, and that is not this face's gap: there is no
   * unarchive on ANY face (`parity-unarchive`), so the archive file is the
   * restore path for now and the confirm says so rather than implying a bin
   * somebody can open.
   */
  Schema.Struct({ verb: Schema.Literal("archive"), id: Id }),
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
