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
 *     chosen ids, no `seed` on a created outline, no `blocks`) and, where it
 *     differs, it differs because something is resolved behind it. Where
 *     nothing is (`title`, `desc`, `date`, `repeat`, `archive`, `unarchive`, `unmirror`,
 *     `mirror`, `see`, `after`), it uses the ops layer's own word — and its own
 *     FIELDS — so a name that differs from an op's is a name with arithmetic
 *     behind it. Ops itself learns none of this — an op does not know it is
 *     being called over a wire, which is what its own manifest says.
 *
 * NOT EVERY VERB IS A KEY, and the ones that are not arrived from two
 * directions that meet in the middle of this list.
 *
 * FOUR ARE THE POINTER'S, and they are here for a rule rather than for a
 * feature: "MCP and Web ops must be consistent; never deviate".
 * An agent could set or clear a date, retire a placement and archive a
 * subtree, and a person at the same directory could do none of them — a
 * standing deviation (`editor-op-parity`), not editor growth. `date`,
 * `unmirror` and `archive` close it for ops that already exist on the other
 * face: each resolves to the request `set_date` / `remove_mirror` /
 * `trash_node` would have sent, judged by the same planner, refused in the
 * same words. Two of them are chosen from the `•••` menu; `date` is sent by
 * that menu (`Clear date`) and by the picker a row's date pill opens.
 * `unarchive` is the fourth and the one exception to "already exist": no face
 * had it (`parity-unarchive`), so the op was born in the ops layer and both
 * faces got it in the same change — the Trash view's `Put back` sends it, and
 * `untrash_node` is the same call.
 *
 * `repeat` IS THE FIFTH OF THAT GROUP, and it is `unarchive`'s case rather
 * than `date`'s: nothing had it. A dated node that comes back is one op born in
 * the ops layer, and both faces got it in the SAME change (`recurring-dates`) —
 * `set_repeat` for an agent, the row's repeat picker for a person — so there
 * was never a moment where one face could say a thing the other could not.
 *
 * TWO MORE ARE THE POINTER'S AND CLOSE THE SAME GAP OVER THE TWO EDGE FIELDS.
 * `see` and `after` are `set_see` and `set_after`, in the ops layer's own shape,
 * and until they landed a person could READ both — the `see` links under a
 * node, the dim and the `blocked by` line of a blocked row — and write neither
 * (`parity-see`, `parity-after`). What reaches them is the `•••` menu's two
 * `…` verbs, each opening the same node search the `((` widget uses, and the
 * `×` on a reference already drawn. `outlineNew` is the last of the group and
 * the one that is about a FILE rather than a node: `create_outline`, from the
 * sidebar, beside `docNew` (`parity-create-outline`).
 *
 * `mirror` is the sixth of that group and the one a KEY sends after all: it is
 * `add_mirror`, and what reaches it is the `((` widget in a row's title
 * (`input-widgets`). It is filed here rather than with the keys because the
 * gap it closes is the same one — an agent could place a second copy of a node
 * and a person could only retire one — and because `unmirror` had been sitting
 * one line above it since #124 with nothing to answer it.
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
 * ONE IS THE PALETTE'S. `capture` says "put this line in the inbox" — no
 * anchor, no file, no id — because quick capture is the one write whose whole
 * promise is that the page it was made from does not move. Where the inbox is
 * is read on the server like `docDay`'s path, and it is still ONE op at the
 * gate.
 *
 * ONE IS THE SIDEBAR'S, and it is the palette's verb read one convention over.
 * `pin` says "put this page on the shelf" — an address and nothing else — and
 * where the shelf IS is read on the server exactly as the inbox is. What it
 * does NOT have is a twin: unpinning is `archive` of the pin's own node,
 * because the shelf is a file of ordinary nodes and a removal it did not share
 * with `trash_node` would be a verb only one face knew.
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
 * THERE ARE TWO DELETES, AND NEITHER IS AIMED AT A ROW. `emptyTrash` is
 * the first: everything in the Trash, gone for good, behind a confirm that
 * names how many rows go and says plainly that nothing puts them back. It
 * names no node, reaches no live outline, and can only touch records somebody
 * already moved to the Trash and can still see — a bin being emptied rather
 * than a branch being erased. `fileDelete` is the second, and its unit is a
 * FILE: a document whole, or an outline emptied of records, gone for good
 * behind the same kind of confirm. Both are refused rather than widened when
 * they would take something a person cannot see — a record still in an
 * outline, a document a `doc` still names — so what either deletes is what
 * the person was reading when they said yes, and neither has an inverse
 * (git's story, said where these arms are declared).
 *
 * NEITHER REMOVAL BESIDE IT IS ONE. `remove` is the un-create — the inverse of
 * an `add`, bound to no key, narrowed by the resolver to a node with nothing
 * under it, which is a rule about what an UNDO is entitled to. `archive` is the
 * ops layer's own put-away, which the human ruled may take a subtree WITH a
 * confirm naming what goes (2026-08-12); the ids come along, so a mirror or an
 * `after` that named any of it goes on resolving. Both are `trash_node`
 * underneath and neither erases anything. A KEY that erases a branch is still
 * not spellable here, and the deferral #109 recorded (human, 2026-08-11) is
 * still the human's to close — what it is about is work leaving an outline
 * without going anywhere, which is a different gesture from stopping carrying
 * what was already put away. Multi-select and drag-drop are their own items, so
 * neither is expressible here.
 *
 * AND TWO ARE COMPOUND, WHICH IS WHY THEY ARE OPS RATHER THAN SEQUENCES.
 * `split` and `merge` each do several things to an outline at once — a retitle
 * and a create; a retitle, a note, N reparentings and an archive — and each is
 * ONE request at the write gate, planned and validated and renamed together.
 * Assembling them HERE out of the verbs above would have been the deviation
 * the consistency rule forbids at its plainest: the web doing in one keystroke what MCP
 * needs four calls for. So they were born in the ops layer and reached both
 * faces in the same change (`split_node`, `merge_node` — the same two ops),
 * which is the shape `unarchive` arrived in and for the same reason. The other
 * half of the argument is atomicity, and it is the half a caller feels: a
 * sequence can stop in the middle, and a merge that stopped in the middle
 * leaves an outline saying something nobody wrote.
 */

import { OpFailure, Status } from "@olai/format"
import { Schema } from "effect"

/** A node this edit is about — the record occupying a row, which for a text
 *  edit is the node the row SHOWS (a mirror has no title of its own) and for a
 *  move is the placement itself. Which of the two a caller means is decided
 *  where the row is drawn; by the time it is here it is one id. */
const Id = Schema.String

/**
 * Where a new row goes. Four places, because four is what the page offers:
 * after a row (`Enter` at the end of a line), before a row (`Enter` at column
 * 0), under a row that has nothing beneath it yet (the first child of a zoomed
 * node), and first in an outline that holds nothing at all.
 *
 * A tagged union rather than four nullable fields: "after nothing, under
 * nothing, in this file" and "after this, under that" are both spellable with
 * nullable fields and neither means anything, and the server would have to
 * refuse them at runtime instead of the wire refusing them at decode.
 */
/**
 * What a text edit expects to find before it writes — ABSENT when it is not
 * checking, which is what a person typing means.
 *
 * The two text verbs were the only ones a person sends BOTH ways — typing a
 * title is a `title`, and taking that back is a `title` too, because the
 * inverse of setting text is setting the text it replaced — and the prop verb
 * is the third: the chips made a property a long-lived text editor like the
 * title and the note, so its commit and its undo answer the same law. What
 * tells the two directions apart is this field, and it is the same guard
 * `place` gets from carrying a parent AND a neighbour: an undo is only
 * entitled to overwrite what IT wrote. If somebody else has retitled the row
 * since, the two disagree and the write is refused rather than landing on top
 * of their words.
 *
 * Absent rather than optional-null, because `null` is a real answer for a note
 * ("there was none"). Three states, and the wire spells all three: not
 * checking, checking for nothing, checking for this text.
 */
const Was = <A extends Schema.Top>(text: A) =>
  Schema.optionalKey(
    text.annotate({
      description:
        "What this field is expected to hold right now. Omit to overwrite whatever is there " +
        "(last-one-wins, which is what a bare write means); supply to make the write conditional " +
        "— undo rides this field, and the chip's every commit, on the value its box was opened on.",
    }),
  )

export const Anchor = Schema.Union([
  /** Immediately after this node, among its siblings — a new sibling. */
  Schema.Struct({ kind: Schema.Literal("after"), id: Id }),
  /** Immediately before this node, among its siblings — `Enter` at column 0. */
  Schema.Struct({ kind: Schema.Literal("before"), id: Id }),
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
 *
 * The FIFTH way a row moves is `under`, and it is a separate arm for the
 * reason those four are one: it is the only one that names where it is GOING
 * rather than which step it is taking. It is the move-to picker's (`⌘⇧M`), and
 * its own comment says the rest.
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
  /**
   * PUT THIS ROW UNDER THAT NODE — the move-to picker's one write
   * (`⌘⇧M`, `web/src/client/move/`), where the four above are steps a row takes
   * from where it already is.
   *
   * A FIFTH ARM RATHER THAN A FIFTH `how`, because it is the only move that
   * carries a destination: the other four are questions about the snapshot
   * ("under the sibling above", "up a level") and this one names a node the
   * reader chose out of a search of the whole set. Folding it into that enum
   * would have made `id` mean two things and `how` sometimes need a second
   * field.
   *
   * WHERE AMONG THAT PARENT'S CHILDREN IS NOT A FIELD, and that is the same
   * decision `Tab` makes one arm up: last is where a row put under a node goes
   * ({@link Anchor}'s `under` says it for a new row, and `move_node` with a
   * `parent` and no anchor is already exactly this), and "which sibling is last"
   * is a fact about the set, read where the write is judged rather than off a
   * tree a tab drew some frames ago. {@link place} is the other shape — parent
   * AND neighbour, both named — and it is the drag's, because a pointer picking
   * a gap between two rows is a gesture that genuinely names one.
   *
   * It resolves to `move_node` with a `parent`, so every refusal a person meets
   * here is the one an agent meets: a parent in another file (every outline is
   * an independent tree), a parent inside the subtree being moved, an id
   * nothing declares. The picker says the first two at the AIM as well — before
   * `Enter` rather than after it, which is the shape `drag/aim.ts` shipped for
   * a drop over the wrong pane — and neither face invents a rule the other
   * does not have.
   */
  Schema.Struct({
    verb: Schema.Literal("under"),
    id: Id,
    /** The node it goes under. A NODE and never `null`: what the picker
     *  searches is nodes, and "the top level of a file" is not something its
     *  list can offer — a row already at the top of its own outline is there,
     *  and any other file's top level is the cross-file refusal. */
    parent: Id,
  }),
  /** Put the mark on, or take it off — whichever the node is not. The keyboard
   *  binds `done` (`Ctrl+Enter`); the field names a mark because the vocabulary
   *  is the format's own and a fourth mark should not arrive writable
   *  everywhere except here. */
  Schema.Struct({ verb: Schema.Literal("toggle"), id: Id, mark: Status }),
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
  /**
   * `Enter` WITH TEXT ON BOTH SIDES OF THE CARET: this row becomes two.
   *
   * The one key on this list that means two different things depending on
   * where the caret is, and that is not a mode — it is the same sentence a
   * person is already reading. `Enter` at the end of a line opens the next one
   * (`add`); `Enter` in the middle of one cuts it there, which is what every
   * outliner does and what Workflowy trained the hands that will press it.
   *
   * IT CARRIES THE TWO TEXTS, not the caret's index. That is the same decision
   * `title` makes and for a stronger reason: an offset is a range into a field,
   * which nothing on either face may name, and an offset re-planned against a
   * newer snapshot would cut somebody else's retitle in half. Two strings mean
   * the same thing against any revision. It is also why the split is spelled
   * from the DRAFT rather than from the record — what a person is looking at
   * when they press the key is the editor's text, which is the editor's own and
   * not a reading of the set.
   *
   * The `id` is the ROW's own record, which is the same id a `merge` names and
   * the opposite of what a plain text edit here names. A split is two things at
   * once — it says what a node SAYS, and it puts a second row on the page — and
   * the second half decides, because it is the half a reader is looking at.
   * Named through a mirror, the tail would be minted beside the TARGET, in the
   * file that node lives in: a mirror draws its target's children and never its
   * siblings, so the two halves of one sentence would stop being siblings on
   * screen and the caret would follow the tail off the page. So a placement is
   * refused, in the ops layer's own `notANode` words, exactly as a merge at one
   * is. Where the tail lands otherwise is the ops layer's (immediately after
   * the head), so nothing is resolved behind this verb.
   */
   Schema.Struct({
    verb: Schema.Literal("split"),
    id: Id,
    /** What the row KEEPS — everything before the caret, verbatim. */
    title: Schema.String,
    /** What comes OFF it — everything after the caret, verbatim, as the new
     *  sibling's whole title. */
    rest: Schema.String,
    /** The tail's PLACE: `true` is the head's FIRST CHILD rather than its next
     *  sibling — the one placement the browser asks for, when the head's
     *  children are drawn (an expanded parent's next line is its first child,
     *  not the sibling the fold hides behind it). Absent is the sibling, the
     *  reading every other caller keeps. */
    under: Schema.optional(Schema.Boolean),
  }),
  /**
   * `Backspace` AT THE START OF A LINE: this row joins the one above it.
   *
   * The inverse gesture, and the inverse op — `split` read backwards. It
   * carries no text at all, because nothing about it is a draft: the titles
   * being joined are the two the set holds, the sibling above is a fact about
   * the set, and both are read where the write is judged
   * ({@link ../../ops/src/plan.ts}'s `merge`). What the browser decides is
   * only WHEN — a caret at offset zero with nothing selected, which is the one
   * position where `Backspace` has nothing of its own to delete.
   *
   * `id` is the ROW's own record, as `split`'s is: both keys change how many
   * rows there are on the page a reader has open, so both are questions about
   * where rows SIT rather than about what a node says. A merge asked at a
   * mirror is refused in the ops layer's own `notANode` words, naming the node
   * to go to, rather than quietly joining two rows in a file the reader is not
   * looking at.
   *
   * It is refused, in the ops layer's own words, when the row is first among
   * its siblings and when the row above is a mirror; and what happens to the
   * merged row's mark, date and edges is that verb's documented answer, said
   * out loud on the way past as a `nudge`.
   */
  Schema.Struct({ verb: Schema.Literal("merge"), id: Id }),
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
    mark: Schema.NullOr(Status),
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
   * The REPEAT RULE, set or cleared — `set_repeat`'s own reach, spelled exactly
   * as the date above is, because it is the same kind of fact one field along:
   * one optional field, one value, no condition, both directions in one arm so
   * an undo can put back what a clear took.
   *
   * Both halves are a person's from the day it lands — the `•••` menu's `Set
   * repeat…` opens the row's picker and the picker sends the rule; `Stop
   * repeating` sends the `null` — so this verb arrives with no deviation to
   * close, which is what the parity rule asks of a feature built at both doors
   * in one change.
   */
  Schema.Struct({
    verb: Schema.Literal("repeat"),
    id: Id,
    /** `null` stops the recurrence. Anything else is the rule's own TEXT,
     *  verbatim: the grammar is spelled in the file (docs/format.md), so a rule
     *  chosen in a browser crosses as the words that were chosen and meets the
     *  format's per-line check at the far end, exactly as an agent's
     *  `set_repeat` does. Nothing on the way parses it. */
    repeat: Schema.NullOr(Schema.String),
  }),
  /**
   * One CUSTOM property, set or taken off — `set_prop`'s own reach, spelled the
   * way the verb above spells a date and for the same reason: nothing is
   * resolved behind it, and both directions are one field, so an undo can put
   * back what a removal took.
   *
   * `key` travels with the write because a property is a fact with a NAME, and
   * the name is what changed. Which keys are refused — the ones spelled like a
   * field the record already has — is the ops layer's answer in its own words;
   * this surface does not repeat that list, for the reason the menu does not
   * grey out `Mark todo` on a finished row.
   */
  Schema.Struct({
    verb: Schema.Literal("prop"),
    id: Id,
    key: Schema.String,
    /** `null` removes it, which is what an emptied value box means. */
    value: Schema.NullOr(Schema.String),
    /** The value this expects the key to hold right now, `null` for "expects
     *  none" — which is what an ADD is. The chip's commit always sends it (the
     *  snapshot the editor opened on): a property is a text box like the
     *  title and the note now, so the write is conditional the same way, and
     *  a typed commit can no longer land on top of an agent's in-flight write
     *  with nothing on screen to say so. */
    was: Was(Schema.NullOr(Schema.String)),
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
   * Place a SECOND copy of a node that already exists — `add_mirror`, and the
   * other half of the placement pair this surface has been carrying one end of
   * since `menu-verbs`.
   *
   * It is the `((` widget's verb (`input-widgets`): a person types two brackets
   * in a row's title, searches the loaded set through the SAME procedure the ⌘K
   * palette searches it with, and the node they choose is drawn as a row here.
   * Nothing about the target changes — a mirror is exactly `{id, parent, ord,
   * mirror}` — so there is no title, mark or note to send, and a schema that
   * could spell one would be a schema the planner has to refuse.
   *
   * `at` is an {@link Anchor}, which is the same field an `add` carries and the
   * same reason: WHERE a row goes is the one thing a browser knows and the
   * server cannot guess, and the arithmetic behind it — which file, which
   * parent, which `ord` among the siblings there — is the server's, off the
   * snapshot the write is judged against. So `((` on an existing row places the
   * mirror after that row, and `((` in a line that is still a draft places it
   * exactly where that line was going to be.
   *
   * The PLACEMENT's own id is not spellable here, deliberately: this surface
   * names no ids of its own (the header's first paragraph), so the set mints
   * one and the answer's `id` says what it minted — which is also what makes
   * this verb's inverse a plain `unmirror` of that id.
   */
  Schema.Struct({
    verb: Schema.Literal("mirror"),
    /** The node the new row SHOWS. Any node in the loaded set, in any outline;
     *  a target that is itself a placement is followed to the node at the end
     *  of the chain, and one the set does not hold is refused in the ops
     *  layer's own words. */
    target: Id,
    at: Anchor,
  }),
  /**
   * Put a node and everything under it away — `trash_node`, from the menu.
   *
   * A TRASH, not a shredder: the subtree moves to `_olai/Trash.olai` under a
   * scaffold of its ancestors' titles, keeping every id, so a mirror, an
   * `after` or a `see` that named any of it goes on resolving. It is one op —
   * the subtree is the op's unit, not this verb's arithmetic — and the fence
   * around it is not on the wire at all: it is the CONFIRM the menu asks
   * first, naming how many rows go with it (human, 2026-08-12). A fence in
   * this schema would be a rule an agent's `trash_node` does not have, which
   * is the deviation read backwards.
   *
   * AND IT COMES BACK: `unarchive` below is the way out, so the trash really
   * is one — the confirm can promise a bin somebody can open, because the
   * Trash view opens it and `Put back` is on every row.
   */
  Schema.Struct({ verb: Schema.Literal("trash"), id: Id }),
  /**
   * COPY a node and everything under it, as the sibling below — `duplicate_node`,
   * from the row menu and from ⌘⇧D.
   *
   * ONE ID AND NOTHING ELSE, which is the same shape `archive` above has and for
   * the same reason: the subtree is the OP's unit rather than this verb's
   * arithmetic, and everything the copy says is already on disk. No anchor —
   * a duplicate lands beside the thing it duplicates, and where a browser would
   * otherwise have to say "after this row" the server would only be re-deriving
   * what the op already knows.
   *
   * `id` is the ROW's own record, as `split`'s and `merge`'s are, and for their
   * argument exactly: this key puts rows on the page a reader has open. Named
   * through a mirror it would copy the TARGET's subtree, in the file that node
   * lives in, and the copy would appear somewhere nobody is looking — so a
   * placement is refused in the ops layer's own `notANode` words, and the menu
   * offers `Remove this placement` on such a row instead.
   *
   * What lands is the op's to decide and is argued where it is decided
   * ({@link ../../format/src/writing.ts}'s `DuplicateRequest`): fresh ids
   * throughout, every other field verbatim, references inside the subtree
   * following the copy and references out of it keeping their targets.
   */
  Schema.Struct({ verb: Schema.Literal("duplicate"), id: Id }),

  // ── the two EDGES a node carries ─────────────────────────────────────

  /**
   * A node's free cross-references, changed — `set_see`, and the last field a
   * person could READ on this face without being able to write it.
   *
   * The web has drawn `see` since edges-ui and could not add or drop one, which
   * is the deviation this list keeps closing one field at a time
   * (`parity-see`). What reaches it is the `•••` menu's `Link to a node…`,
   * which opens the SAME node search the `((` widget and the ⌘K palette use, and
   * the `×` on a reference already drawn.
   *
   * IT IS THE OP'S OWN SHAPE — two optional lists rather than one target and a
   * direction — for the reason `date` carries the op's full `string | null`:
   * nothing is resolved behind this verb, so it uses the ops layer's word, and a
   * narrower spelling could not express its own inverse. A call that names
   * neither is refused by the planner in its own words ("give `add` and/or
   * `remove`"), which is the sentence an agent gets rather than a second rule
   * here.
   *
   * A `see` is a link and no more, so nothing about it can be refused for what
   * it MEANS — a loop of them is two notes pointing at each other, which is a
   * thing people write on purpose. That is the whole difference between this
   * verb and the one below it.
   */
  Schema.Struct({
    verb: Schema.Literal("see"),
    id: Id,
    /** Ids to add to this node's `see` list — each a node in the loaded set,
     *  refused with the closest id that exists when it is not. */
    add: Schema.optionalKey(Schema.Array(Id)),
    /** Ids to drop from it. Naming one that is not there is a no-op for that
     *  id, and a call that would change nothing at all is refused. */
    remove: Schema.optionalKey(Schema.Array(Id)),
  }),
  /**
   * What a node must come AFTER, changed — `set_after`, and {@link see}'s shape
   * exactly, because it is the same gesture over the other kind of edge
   * (`parity-after`).
   *
   * The web has drawn blockedness since edges-ui — the dimmed row, the mark
   * column's glyph, the `blocked by` line on a node's page — and a person could
   * not declare or lift a single dependency. What differs from `see` is what the
   * edges MEAN: `after` is the ordering graph, so an add that would close a loop
   * is REFUSED, naming the loop it would close, and that sentence reaches this
   * face verbatim like every other refusal. Nothing here fences it
   * first — a rule this schema enforced would be a rule an agent's `set_after`
   * does not have.
   *
   * WHAT IT WRITES IS THE NODE'S OWN `after`, never the `blocks` on somebody
   * else's record: `a blocks b` IS `b after a`, and the ops layer writes the
   * arrow one way so that one relation is not on disk in two spellings. So the
   * removable edges are the ones this node declares — which is exactly what the
   * page draws as `after`, beside the DERIVED `blocked by` it may not touch.
   */
  Schema.Struct({
    verb: Schema.Literal("after"),
    id: Id,
    /** Ids this node must come after. An add that would close a loop is refused
     *  naming it. */
    add: Schema.optionalKey(Schema.Array(Id)),
    /** Ids to drop from its `after` list. */
    remove: Schema.optionalKey(Schema.Array(Id)),
  }),
  /**
   * Take a node and everything under it back OUT of the archive —
   * `untrash_node`, from the Trash view's `Put back`, and the other half of
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
    verb: Schema.Literal("untrash"),
    id: Id,
    /** The live node it goes back under — an undo's record of where it sat.
     *  Absent, the archive's own chain decides. */
    parent: Schema.optionalKey(Id),
    /** The outline whose top level it goes back to, when it sat at one.
     *  Ignored when `parent` is present. */
    file: Schema.optionalKey(Schema.String),
  }),
  /**
   * EMPTY THE TRASH — permanently delete everything in it, and the ONE write
   * on this surface that destroys.
   *
   * IT NAMES NO TRASH, and that is the shape of it. Which archives the
   * directory holds, and which of them have anything in them, are facts about
   * the SET — so they are read where the write is judged
   * ({@link ../../server/src/edit.ts}), exactly as the inbox `capture` lands in
   * is and for the identical argument. What the browser sends is the gesture; a
   * tab that listed the archives itself would be a second reading of the
   * directory, some frames old, free to disagree with the one on disk — and the
   * disagreement would surface as a pile quietly left behind rather than as a
   * refusal.
   *
   * IT RESOLVES TO ONE `empty_trash` NAMING EVERY PILE, which is the op's own
   * shape rather than a convenience: what may still point into an archive is
   * judged against the UNION of every archive the write empties, so a `see`
   * from one pile into another is a record that goes rather than a holder that
   * refuses. Spelled as a batch of one-per-archive — which it was — the same
   * two piles refuse in one order and plan in the other, and refuse both ways
   * round when they name each other. Nothing an agent cannot send: the op takes
   * the list, and an agent emptying a whole directory makes the same two moves
   * by hand (`list_outlines`, then the call). What the browser is spared is the
   * READING, not an op — quick capture's sentence, a page over.
   *
   * WHAT IT DOES CARRY is the number the confirm showed, and only that
   * ({@link was} below): a count nobody is asked to compute, checked where
   * every other condition is checked.
   *
   * **THIS IS THE DELETE, AND IT IS NOT THE DELETE THE DEFERRAL IS ABOUT.**
   * The header above has said since #124 that no key erases a branch, and that
   * is still true: nothing here names a node, nothing here reaches a live
   * outline, and the only rows it can touch are ones somebody already moved to
   * the Trash and can still see. #109's deferral is about a key that takes work
   * out of an outline, and it stays the human's to close. What this closes is
   * the other half of a trash — a bin nothing could ever be emptied from is a
   * bin that only fills up.
   *
   * It answers with NO INVERSE, which is the honest half. `unmirror` is the
   * other write that answers that way, and it does so because the surface
   * cannot spell the placement back; this one does so because there is nothing
   * anywhere that can. What the records are recoverable from is git, to exactly
   * the extent git had already recorded them — which is a thing a person does
   * in a terminal, and never something ⌘Z should pretend to do. So the FENCE is
   * the confirm the Trash page asks first, naming how many rows go and saying
   * plainly that this is not undoable (`web/src/client/trash/question.ts`) —
   * and the fence is not on the wire, for the reason `archive`'s is not: a rule
   * this schema enforced would be a rule an agent's `empty_trash` does not
   * have.
   */
  Schema.Struct({
    verb: Schema.Literal("emptyTrash"),
    /**
     * How many rows the CONFIRM named — the number a person read and agreed
     * to, carried so the write can be refused if the trash has moved since.
     *
     * The one field on this verb, and it is here for the reason {@link Was} is
     * on the two text verbs: a write is re-planned against a newer snapshot
     * when the store moves under it, and a re-plan of this one silently
     * WIDENS. A record archived between the frame somebody read and the write
     * landing is a record the retry deletes, under a sentence that named a
     * smaller number. So the number travels, and the ops layer checks it on
     * every attempt against the snapshot that attempt is judged on — never
     * here, which is the TOCTOU the undo's `was` was found to have.
     *
     * It is a COUNT rather than the ids, because a count is what the sentence
     * says. The ids would refuse for a re-archive that left the same total,
     * which is a different promise from the one a person was shown.
     *
     * Optional on the wire, because `empty_trash` is optional for an agent:
     * a sweep that shows nobody a number means "whatever is there". Every
     * caller in this client sends it.
     */
    was: Schema.optionalKey(Schema.Int),
  }),

  // ── the palette's one ────────────────────────────────────────────────

  /**
   * A LINE, CAPTURED — the ⌘K palette's quick capture, and racket's `olai add`
   * read into a browser.
   *
   * It carries a title and NOTHING ELSE, which is the whole of the gesture: a
   * thought arrives while somebody is reading something unrelated, and the
   * point is that it lands somewhere they will look later without their page,
   * their scroll or their caret moving at all. A verb that took an anchor
   * would be `add` under another name, and `add` is already how a person puts
   * a row where they are standing (`Enter`).
   *
   * WHERE IT LANDS IS THE SERVER'S, exactly as `docDay`'s path is and for the
   * same argument: the inbox is a fact about the SET — the outline named
   * `Inbox.olai`, if the directory has one — so it is read against the
   * reading the write is judged on rather than in a tab holding a file list
   * some frames old. That is also what makes this ONE op rather than a
   * sequence: an existing inbox takes an `add`, a directory with none takes a
   * `create` seeded with this very title, and a seed that is refused leaves no
   * file behind ({@link ../../server/src/edit.ts}).
   *
   * An agent makes the same two moves by hand — read the outlines, then
   * `add_node` or `create_outline` — so nothing here is a reach the tools do
   * not have. What the browser is spared is the READING, not an op.
   */
  Schema.Struct({ verb: Schema.Literal("capture"), title: Schema.String }),

  // ── the shelf's one ──────────────────────────────────────────────────

  /**
   * A PAGE, PINNED — the sidebar's shelf gains a door onto whatever is on
   * screen: a node's own page, a document, or the page a reader has narrowed
   * with a query.
   *
   * It carries an ADDRESS and nothing else, and that is the whole design
   * argument. A pin is not a placement of a node — a mirror already means
   * "draw it here too", and a shelf that drew every pinned node's subtree
   * inside `Pins.olai` would be saying something nobody meant — and it is not
   * a field on a record either, because half the things worth pinning (the
   * agenda, a day, a filtered outline) are not nodes at all. What every one of
   * them IS is an address, this app already has exactly one spelling of those
   * (`web/src/client/routes.ts`'s bijection), and a node's title is text. So a
   * pin is an ordinary node whose title is the address, in an ordinary outline
   * — and an agent pins, reorders and unpins with `add_node`, `move_node` and
   * `trash_node`, which is the consistency rule paid up front rather than
   * closed later.
   *
   * WHERE IT LANDS IS THE SERVER'S, exactly as {@link capture}'s inbox is and
   * for the same argument: which file the shelf IS is a fact about the SET —
   * the outline named `Pins.olai`, if the directory has one (`@olai/format`'s
   * `pinsIn`) — so it is read against the reading the write is judged on
   * rather than in a tab holding a file list some frames old. That is also
   * what makes this ONE op rather than a sequence: an existing shelf takes an
   * `add`, a directory with none takes a `create` seeded with this very
   * address, and a seed that is refused leaves no file behind
   * ({@link ../../server/src/edit.ts}).
   *
   * THERE IS NO `unpin`, deliberately: taking a pin off the shelf is
   * {@link archive} of that pin's own node, which is the removal the set
   * already has — reversible from the Trash, and undoable with ⌘Z like every
   * other write here. A second verb would be `trash_node` under a name only
   * one face knew.
   */
  Schema.Struct({
    verb: Schema.Literal("pin"),
    /**
     * The address, exactly as this app spells one — `/#<id>`, `/<path>`,
     * `/agenda?q=…`. Verbatim: nothing between the affordance that minted it
     * and the node's title parses it, for the reason a `date` crosses as the
     * ten characters that were picked. What reads it back is the same
     * bijection that wrote it, in the browser, at view time.
     */
    at: Schema.String,
    /**
     * WHAT TO CALL IT, when somebody said — absent for the ordinary pin, which
     * is a bare address drawn by whatever it points at.
     *
     * It is a field on this VERB and not a field on a record: what lands is
     * still one ordinary node whose title is `[name](address)`, which is the
     * spelling `Pins.olai` has always had for a named pin and the one an agent
     * writes by hand (docs/format.md's Pins). So the format grew nothing, and
     * the consistency rule is paid the way pinning itself paid it — an agent
     * names a pin with the `add_node` it already has, and renaming one on
     * either face is `set_title` on that row.
     *
     * WHY IT RIDES ALONG rather than being a `set_title` sent after the pin:
     * one intention is one op. Two writes would be two rounds through the gate
     * and two entries on the undo stack — so ⌘Z would leave a nameless pin
     * standing — with a window between them in which the shelf holds a row
     * nobody meant to leave bare.
     *
     * THE TITLE IS SPELLED WHERE THE ADDRESS IS RESOLVED
     * ({@link ../../server/src/edit.ts}), with `@olai/format`'s `pinTitle` —
     * the inverse of the reader that draws one. A browser that spelled it here
     * would be writing a title past the one field this verb promises to carry
     * verbatim, and a name the link's grammar cannot hold is refused there, in
     * that function's own words.
     */
    name: Schema.optionalKey(Schema.String),
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
   * The day page's + day note, pressed — mint that day's note. The verb carries the
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

  // ── and the OUTLINE's one ────────────────────────────────────────────

  /**
   * A brand-new outline, named outright — `create_outline`, from the sidebar's
   * `+ New outline`, and the last file MCP could mint that a person could not
   * (`parity-create-outline`).
   *
   * {@link docNew}'s twin, spelled the same way and for the same reasons: the
   * path is what a person types, because a file's name is its address in this
   * app, and every rule about that path — relative, no `..`, not one the set
   * already holds — is the OP's, surfaced verbatim rather than re-implemented
   * in a browser that would then disagree with an agent.
   *
   * WHAT ARRIVES IS COMPLETED, and that is the one half the browser settles
   * first: the sidebar's box knows which kind it makes, so a person may type
   * `Foo` and this field carries `Foo.olai` (`@olai/web`'s
   * `file/completing.ts`). The op is unchanged by it and still demands the
   * suffix — an agent naming a file has no door around it.
   *
   * IT CARRIES NO SEED, and that is the one place it says less than the tool
   * does. `create_outline` may be born holding a whole tree, which is what
   * saves an agent a second call; a person types the first row with `Enter`
   * ({@link Anchor}'s `first` arm, which exists for exactly this file), so the
   * seed would be a field no affordance could fill. Nothing the web can reach is
   * out of the agent's reach, which is the direction the consistency rule
   * actually runs — and quick capture already sends a seeded `create` when the
   * directory has no inbox, so the op's full shape is reachable from this face.
   */
  Schema.Struct({
    verb: Schema.Literal("outlineNew"),
    file: Schema.String,
  }),
  /**
   * DELETE THIS FILE — the document page's and the empty outline's one
   * destructive gesture, and the second delete this surface has.
   *
   * The path, and NOTHING else: the guards are the op's, and they are the
   * whole story. A document goes whole and outright; an outline goes only
   * when it holds no records; and both are refused — naming what to settle
   * first — rather than widened, because deleting what a person cannot see
   * is the failure this arm exists not to have. See the arm an undo speaks
   * of nowhere here: THIS ONE HAS NO INVERSE, and that is the design
   * statement `@olai/server`'s `inverseOf` spells next to it — an un-delete
   * is git's, exactly as it is for `emptyTrash`, and the confirm that
   * reaches it says so in words rather than discovering it after.
   *
   * THE CONFIRM LIVES IN THE CLIENT and asks its own question with the file
   * in it (`@olai/web`'s `file/DeleteFile.tsx`), exactly as `emptyTrash`'s
   * does: the surface carries the verb, and the certainty is a person-level
   * fact, asked where the person is.
   */
  Schema.Struct({
    verb: Schema.Literal("fileDelete"),
    file: Schema.String,
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
    /** The parent it sat under — `null` for the top level of the outline
     *  named below. */
    parent: Schema.NullOr(Id),
    /**
     * The OUTLINE it sat in — carried because a `move_node` may now take a row
     * out of one and into another, and then "the top level of its file" is a
     * different file than it was.
     *
     * Only load-bearing when {@link parent} is `null`: with a parent, the file
     * is wherever that parent lives and a second answer could only disagree
     * with it (the ops layer's own rule, spelled once on `add_node`'s pair and
     * read the same way here). Optional, because a placement recorded before
     * anything crossed still means what it said, and because the reorder
     * gestures that emit one — a drag, the pin shelf — cannot cross.
     */
    file: Schema.optionalKey(Schema.String),
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
   * node goes to `_olai/Trash.olai` keeping its id, which is a trash rather than
   * a shredder and is exactly what `trash_node` does for an agent.
   *
   * What the WIRE guarantees is the narrowing, and it is worth saying in those
   * terms rather than in the client's: this is `trash_node` minus every node
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
  /**
   * What that node says NOW — the title the write left on it.
   *
   * It is here for the two writes that CHANGE a title without being told what
   * it should say. Every other verb either leaves the text alone or carries it
   * (`title` sends the words it is setting), so the editor already knows; a
   * `merge` does not, because the joined title is the row above's plus this
   * one's, and the row above's is a fact about the set. A browser reading it
   * off the tree it drew would be the second reading this seam exists to
   * avoid — and a draft left holding the OLD text would write it straight back
   * over the join on the next idle tick.
   */
  title: Schema.String,
  /**
   * WHICH OUTLINE it landed in — for the write whose caller did not name one.
   *
   * Quick capture is that write: it sends a line and no file, because where
   * the inbox is is a fact about the set. So the tab that captured cannot say
   * where the line went unless the answer says, and a tab that guessed would
   * be inventing a placement one door after arguing it may not compute one —
   * "captured to the Inbox" over a directory that keeps `notes/inbox.olai`.
   * It rides back for every verb rather than for that one, because the ops
   * layer answers with it for every op already and a field present only
   * sometimes is a field a reader has to know the verbs to use.
   *
   * The DOCUMENT verbs are the precedent read one door up: a minted note's
   * path is the server's to derive and the page that opens it reads the reply
   * ({@link ../../web/src/client/document/minted.ts}).
   */
  file: Schema.String,
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
