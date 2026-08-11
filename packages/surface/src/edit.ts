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
 * Two properties are worth stating because both are decisions:
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
 *   - **This is not the ops request vocabulary re-spelled.** It is smaller (no
 *     `create`, no `archive`, no `see`, no `date`, no chosen ids) and it is in
 *     different terms (`in` / `out` / `up` / `down`, `toggle`). The mapping onto
 *     ops requests is one function in the server, and it is total: a fourth
 *     intent that nothing answers is a type error there rather than a call that
 *     lands nowhere. Ops itself learns none of this — an op does not know it is
 *     being called over a wire, which is what its own manifest says.
 *
 * What is deliberately ABSENT is a delete. It arrives with the undo item
 * (human, 2026-08-11): until an edit can be taken back inside the app, git is
 * the whole of the recovery net, and a key that removes a subtree is the one
 * edit a person cannot re-type from memory. Split/merge, multi-select and
 * drag-drop are their own items too, so none of them is expressible here.
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

export const AddInput = Schema.Struct({
  at: Anchor,
  /** Verbatim, as typed. An empty one is refused by the ops layer — a node
   *  needs a title — which is why the editor holds a new row as a DRAFT until
   *  it has one rather than writing a blank and filling it in. */
  title: Schema.String,
})

/** What a new row answers with: the id the set gave it. The row itself arrives
 *  on the outlines collection like every other change; this is what lets the
 *  editor follow it — the next `Enter` anchors after this id, and the caret
 *  stays in the row that was just written. */
export const Added = Schema.Struct({ id: Id })
export type Added = typeof Added.Type

/**
 * The four ways a keyboard moves a row, and the whole of what the arrows and
 * `Tab` mean:
 *
 *   - `in` — under the sibling above it, last among that node's children
 *     (`Tab`);
 *   - `out` — up a level, immediately after what used to be its parent
 *     (`Shift+Tab`);
 *   - `up` / `down` — swap with the sibling above or below (`Alt+Shift+↑/↓`).
 *
 * All four are one `move` op. Which is why they are one procedure with an enum
 * rather than four: a move is a move, and the difference between them is
 * entirely a question about the snapshot.
 */
export const MoveInput = Schema.Struct({
  id: Id,
  how: Schema.Literals(["in", "out", "up", "down"]),
})
export type MoveInput = typeof MoveInput.Type

/** Put the mark on, or take it off — whichever the node is not. The keyboard
 *  binds `done` (`Ctrl+Enter`); the field names a mark because the vocabulary
 *  is the format's own and a fourth mark should not arrive writable everywhere
 *  except here. */
export const ToggleInput = Schema.Struct({
  id: Id,
  mark: Schema.Literals(MARKS),
})

export const TitleInput = Schema.Struct({
  id: Id,
  title: Schema.String,
})

export const NoteInput = Schema.Struct({
  id: Id,
  /** `null` removes the note, which is what an emptied textarea means. */
  desc: Schema.NullOr(Schema.String),
})

/**
 * The procedures, as the spec declares them.
 *
 * Every one declares {@link OpFailure} as its error channel, and that is the
 * half of this design the editor is built on: a refused write comes back as
 * the validator's own rows, so the draft it came from can be KEPT and the
 * reason shown beside it. A refusal that flattened into a transport error
 * would be a keystroke silently lost.
 */
export const editProcedures = {
  add: { input: AddInput, output: Added, error: OpFailure },
  move: { input: MoveInput, error: OpFailure },
  toggle: { input: ToggleInput, error: OpFailure },
  retitle: { input: TitleInput, error: OpFailure },
  note: { input: NoteInput, error: OpFailure },
} as const

/**
 * One edit, as a value — the union of everything {@link editProcedures} can
 * carry, tagged by the verb that carried it.
 *
 * Declared here rather than in the server so the thing that maps an intent
 * onto an ops request is a total function of a type this file owns: adding a
 * verb above without answering it is then a compile error rather than a
 * procedure that decodes fine and does nothing.
 */
export type Edit =
  | ({ readonly verb: "add" } & typeof AddInput.Type)
  | ({ readonly verb: "move" } & MoveInput)
  | ({ readonly verb: "toggle" } & typeof ToggleInput.Type)
  | ({ readonly verb: "retitle" } & typeof TitleInput.Type)
  | ({ readonly verb: "note" } & typeof NoteInput.Type)
