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
 *     `Ctrl+Enter` says "toggle done", not "set done" or "clear done";
 *     `Ctrl+Shift+Enter` says "walk this row's mark on", not which mark that
 *     lands on. What a row's neighbours are, and what mark it carries, are
 *     facts about the snapshot — so they are read where the snapshot IS
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
 *     nothing is (`title`, `desc`, `date`, `archive`, `unarchive`, `unmirror`),
 *     it uses the ops layer's own word, so a name that differs from an op's is
 *     a name with arithmetic behind it. Ops itself learns none of this — an op
 *     does not know it is being called over a wire, which is what its own
 *     manifest says.
 *
 * NOT EVERY VERB IS A KEY, and the ones that are not arrived from two
 * directions that meet in the middle of this list.
 *
 * FOUR ARE THE POINTER'S, and they are here for a rule rather than for a
 * feature: "MCP and Web ops must be consistent; never deviate" (HACKING.md).
 * An agent could set or clear a date, retire a placement and archive a
 * subtree, and a person at the same directory could do none of them — a
 * standing deviation (`editor-op-parity`), not editor growth. `date`,
 * `unmirror` and `archive` close it for ops that already exist on the other
 * face: each resolves to the request `set_date` / `remove_mirror` /
 * `archive_node` would have sent, judged by the same planner, refused in the
 * same words. Two of them are chosen from the `•••` menu; `date` is sent by
 * that menu (`Clear date`) and by the picker a row's date pill opens.
 * `unarchive` is the fourth and the one exception to "already exist": no face
 * had it (`parity-unarchive`), so the op was born in the ops layer and both
 * faces got it in the same change — the Trash view's `Put back` sends it, and
 * `unarchive_node` is the same call.
 *
 * TWO ARE AN UNDO'S, and they are the one place this list is not shaped like a
 * key at all. `place` and `remove` say where a row SAT and that a row this
 * session created should go — facts a structural op destroyed, recorded at
 * apply time ({@link Applied.undo}) and replayed through this same procedure
 * when somebody presses ⌘Z. They name absolute things because that is what "put
 * it back" means; what keeps that honest is WHO NAMED THE IDS — the server
 * derived every one of them from the snapshot the original write was judged
 * against, so they are ids an agent would have named, and the replay is judged
 * against the snapshot as it is NOW. Nothing here restores a snapshot: an undo
 * is one more op at the write gate, refused like any other when the set has
 * moved somewhere the inverse cannot go.
 *
 * AND ONE IS BOTH THEIRS. `mark` names the mark a node should carry, which is
 * what a menu entry means ("this is doing now") and what an undo means ("it
 * carried `todo` before I ticked it off"). Two callers, one arm — a second
 * would have been the same request under two names, free to drift.
 *
 * THE TWO TEXT VERBS NEED NO UNDO TWIN, and that is the difference worth
 * seeing: the inverse of setting a title is setting the title it replaced, so
 * an undo sends `title` — the same verb, the same op, the other text. What it
 * adds is {@link Was}: the text it expects to find. A person typing overwrites
 * whatever is there (which is what `set_title` does for an agent); an undo may
 * only overwrite what IT wrote, so somebody else's words are refused rather
 * than replaced.
 *
 * WHAT IS STILL DELIBERATELY ABSENT IS A DELETE, and neither removal here is
 * one. `remove` is the un-create — the inverse of an `add`, bound to no key,
 * narrowed by the resolver to a node with nothing under it, which is a rule
 * about what an UNDO is entitled to. `archive` is the ops layer's own put-away,
 * which the human ruled may take a subtree WITH a confirm naming what goes
 * (2026-08-12); the ids come along, so a mirror or an `after` that named any of
 * it goes on resolving. Both are `archive_node` underneath and neither erases
 * anything. A key that erases a branch is still not spellable here, and the
 * deferral #109 recorded (human, 2026-08-11) is still the human's to close.
 * Split/merge, multi-select and drag-drop are their own items, so none of them
 * is expressible here either.
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
/**
 * What a text edit expects to find before it writes — ABSENT when it is not
 * checking, which is what a person typing means.
 *
 * The two text verbs are the only ones a person sends BOTH ways: typing a
 * title is a `title`, and taking that back is a `title` too, because the
 * inverse of setting text is setting the text it replaced. What tells the two
 * apart is this field, and it is the same guard `place` gets from carrying a
 * parent AND a neighbour: an undo is only entitled to overwrite what IT wrote.
 * If somebody else has retitled the row since, the two disagree and the write
 * is refused rather than landing on top of their words.
 *
 * Absent rather than optional-null, because `null` is a real answer for a note
 * ("there was none"). Three states, and the wire spells all three: not
 * checking, checking for nothing, checking for this text.
 */
const Was = <A extends Schema.Top>(text: A) =>
  Schema.optionalKey(
    text.annotate({
      description:
        "What this field is expected to hold right now. Omit to overwrite whatever is there (typing); supply it to make the write conditional (undo).",
    }),
  )

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
  /**
   * The MARK WALK: put this node at the next answer along, whatever it is on
   * now — `Ctrl+Shift+Enter`, and the keyboard's half of writing all three
   * marks.
   *
   * It carries no mark for the same reason `toggle` carries no direction:
   * where the walk goes depends on where the node IS, that is a fact about the
   * snapshot, and a tab that read it off a frame it drew a moment ago would be
   * asking for a step somebody else has already taken. The ring itself — which
   * answer follows which, and that `done` is not one of its stops — is the
   * resolver's ({@link ../../server/src/edit.ts}), beside the reading it needs.
   *
   * WHAT IT IS NOT is a shortcut past anything the ops layer judges. The step
   * it resolves to is one op — the same `set_todo` / `set_doing` / undo an
   * agent would send — so a walk asked of finished work is REFUSED, in the ops
   * layer's own words, under the row the key was pressed in. Two calls walk
   * `done` back and the second one is the person's, which is the rule the `•••`
   * menu already keeps for the mouse.
   */
  Schema.Struct({ verb: Schema.Literal("walk"), id: Id }),
  Schema.Struct({
    verb: Schema.Literal("title"),
    id: Id,
    title: Schema.String,
    /** What the title is EXPECTED to say right now, when the caller is putting
     *  something back rather than typing something new — see {@link Was}. */
    was: Was(Schema.String),
  }),
  Schema.Struct({
    verb: Schema.Literal("desc"),
    id: Id,
    /** `null` removes the note, which is what an emptied textarea means. */
    desc: Schema.NullOr(Schema.String),
    /** The note this expects to find, `null` for "expects none". */
    was: Was(Schema.NullOr(Schema.String)),
  }),

  // ── the one BOTH the menu and an undo name ───────────────────────────

  /**
   * The mark this node should CARRY — named outright, where `toggle` names one
   * and lets the server read which way it goes.
   *
   * TWO CALLERS ARRIVED AT THE SAME VERB, from opposite directions, and that is
   * the argument for it being one arm rather than two. A menu entry means "this
   * node is doing now", whatever it was a moment ago — it was chosen from a
   * list drawn beside the mark it is replacing. An undo means "it carried
   * `todo` before I ticked it off" — a fact only the write that displaced it
   * knew. Both name the mark absolutely; neither can be spelled as a toggle,
   * which cannot say WHICH way it goes without reading the stored mark, and
   * would make a menu ask for `done` to reach `todo` and hope nobody else wrote
   * in between.
   *
   * `null` is "carrying none", which a toggle cannot say either: the format
   * allows AT MOST ONE mark, so taking a mark off is not the absence of putting
   * one on. Which op that becomes is the resolver's
   * ({@link ../../server/src/edit.ts}) — the mark's own op, or the stored
   * mark's with `undo` — because "what is on it now" is a fact about the set.
   */
  Schema.Struct({
    verb: Schema.Literal("mark"),
    id: Id,
    mark: Schema.NullOr(Schema.Literals(MARKS)),
  }),

  // ── the three the ••• menu speaks ────────────────────────────────────

  /**
   * The scheduling date, set or cleared — `set_date`'s own reach, spelled the
   * way {@link Applied} spells `desc`, because nothing is resolved behind it.
   *
   * BOTH HALVES ARE A PERSON'S NOW, and they arrived a PR apart: the `•••`
   * menu's `Clear date` sends the `null`, and the date picker a row opens —
   * from its own date pill, or from the menu entry beside that verb — sends
   * the day (`parity-date`). The field was the op's full one from the first
   * day regardless, which is the point of this verb existing at all: the
   * deviation being closed is "MCP can change a node's date and a person
   * cannot", so the wire says what the op says and the UI arrived at its own
   * pace. It is also what lets an undo put a cleared date back, which a
   * clear-only verb could not spell.
   */
  Schema.Struct({
    verb: Schema.Literal("date"),
    id: Id,
    /**
     * `null` clears it. Anything else is the value VERBATIM — a date is text
     * in this format (docs/format.md), so a day picked in a browser crosses
     * as the ten characters that were picked and reaches the validator as
     * they were typed. Nothing on the way parses one, and the validator is
     * the gate at the far end, exactly as it is for an agent's `set_date`.
     */
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
   * AND IT COMES BACK: `unarchive` below is the way out, so the trash really
   * is one — the confirm can promise a bin somebody can open, because the
   * Trash view opens it and `Put back` is on every row.
   */
  Schema.Struct({ verb: Schema.Literal("archive"), id: Id }),
  /**
   * Take a node and everything under it back OUT of the archive —
   * `unarchive_node`, from the Trash view's `Put back`, and the other half of
   * `parity-unarchive`: the op was born in the ops layer and reached both
   * faces together, so neither face can do what the other cannot.
   *
   * The two optional fields are AN UNDO'S, not the button's. `Put back` sends
   * the id alone, and where the subtree lands is the ops layer's own default:
   * the chain of ancestor titles the archive recorded, matched back against
   * the live outlines — refused, naming what it found, when that chain matches
   * nowhere or more than one place. An undo of an `archive` knows better than
   * the chain does: the server read the row's actual parent (or its file, at
   * top level) off the snapshot the archive was judged against, and those are
   * ids an agent would have named — the same rule `place` follows.
   */
  Schema.Struct({
    verb: Schema.Literal("unarchive"),
    id: Id,
    /** The live node it goes back under — an undo's record of where it sat.
     *  Absent, the archive's own chain decides. */
    parent: Schema.optionalKey(Id),
    /** The outline whose top level it goes back to, when it sat at one.
     *  Ignored when `parent` is present. */
    file: Schema.optionalKey(Schema.String),
  }),

  // ── the documents' three ─────────────────────────────────────────────

  /**
   * A DOCUMENT's text, replaced whole — the editor a `.md` page becomes, and
   * the one verb here whose subject is a file rather than a node, because a
   * document has no node: its unit is the file, and `file` is spelled the way
   * every other reading of one is (root-relative, the collection's own key).
   *
   * `was` is the draft's guard, and it is the text verbs' `was` at file size:
   * the editor sends what it READ, so a file that moved underneath it — vim,
   * a `git pull`, the agent — refuses the commit instead of being silently
   * clobbered, and the refusal keeps the draft (the silent-errors doctrine,
   * where it matters most). Omitting it is how "overwrite anyway" is spelled,
   * which is a thing a person may explicitly choose after reading the refusal.
   */
  Schema.Struct({
    verb: Schema.Literal("doc"),
    file: Schema.String,
    text: Schema.String,
    was: Was(Schema.String),
  }),
  /**
   * A brand-new document, named outright — the sidebar's creation affordance.
   * The one OTHER place this surface names a file, and for the same reason
   * `Anchor`'s `first` does: there is nothing in the set yet to anchor on.
   * Resolves to the ops layer's own create, so a path that exists or smuggles
   * a `..` is refused in the same words an agent's `create_document` gets.
   */
  Schema.Struct({
    verb: Schema.Literal("docNew"),
    file: Schema.String,
  }),
  /**
   * A bare calendar day, pressed — mint that day's note. The verb carries the
   * DATE and not a path, and that asymmetry is the whole design: where the
   * vault keeps its daily notes is a fact about the set (the newest existing
   * note's own path is the convention, `@olai/format`'s `dailyNotePathFor`),
   * so it is read on the server, against the reading the write is judged on,
   * rather than computed in a tab from a document list some frames old — the
   * same argument that makes `Tab` say "indent this". An agent minting a note
   * makes the same two moves by hand: read the paths, `create_document`.
   */
  Schema.Struct({
    verb: Schema.Literal("docDay"),
    date: Schema.String,
  }),

  // ── the two an undo speaks ───────────────────────────────────────────

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
   *
   * AND IT COMES BACK — `unarchive` is what an undo of this one answers with
   * now, carrying the place the row sat, so ⌘Z on an un-create is no longer
   * the one entry that could not be redone.
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
   * everything but the write that TICKS A NODE OFF: putting `todo` back on a
   * node that is now `done` is two ops, because the ops layer refuses to walk
   * finished work backwards in one (`plan.ts` — "undo that first"). Two calls
   * is exactly what an agent would make, which is what keeps the faces
   * consistent; a shortcut here would be the web doing something MCP cannot.
   * Every other way back is ONE — including taking a mark off, whose inverse is
   * simply putting it on again.
   *
   * ABSENT when nothing would take it back, which is now only the write that
   * has already gone somewhere no op reaches: a row taken into the archive
   * (`move` is same-file by the format). A TEXT edit answers with one like
   * everything else — the human drove this and found the hole (2026-08-12):
   * a title committed and then ⌘Z'd said "nothing to undo", which is an undo
   * that does not undo. What made the hole was reading "drafts are excluded"
   * as "text is excluded"; the ruling is about the chord being dead while an
   * editor is OPEN — that undo is the input's own — and says nothing about the
   * op a committed draft produced. A committed title has a perfect inverse.
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
