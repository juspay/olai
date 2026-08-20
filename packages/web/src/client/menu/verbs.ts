/**
 * What a surface may WRITE about one node, as values.
 *
 * The catalog of write verbs, pure over the SUBJECT it was asked about: which
 * entries a reader is offered, and the exact {@link Edit} each one sends — or,
 * for the FIVE whose value a person still has to choose, which panel the row
 * opens ({@link Does}: the two pickers, the two edge panels, and the move-to
 * picker). No socket, no clipboard and no component — those are
 * `./actions.ts`'s — so the two decisions that live here are decidable in a
 * unit test:
 *
 *   - **which of them apply.** Every entry in this list changes something. A
 *     verb that would be refused for asking about nothing is not drawn at all:
 *     no `Clear date` on a row with no date, no `Remove this placement` on a
 *     row that is not one, no `Mark doing` on a node that is already doing.
 *   - **which ID each names**, which is the rule the whole editor is built on.
 *     A mark and a date are facts about the node a row SHOWS, so a mirror
 *     marks its target — the same node its checkbox draws. Retiring a
 *     placement is about the row's OWN record, which is what a placement is.
 *
 * WHAT IS NOT FENCED HERE is anything the ops layer judges. A `done` node
 * still offers `Mark todo`, and choosing it is refused in the ops layer's own
 * words — "nothing should decide on your behalf that finished work is not
 * finished" — which is the sentence a person needs, and the two clicks it asks
 * for are the two calls an agent makes (HACKING.md's consistency rule). A menu
 * that greyed that entry out would be teaching a rule this app does not have.
 *
 * IT IS ASKED ABOUT A {@link Subject} RATHER THAN ABOUT A ROW, because two
 * surfaces ask it now and only one of them has a row. The `•••` menu asks
 * about the line it hangs off; the ⌘K palette asks about the node the reader
 * has ZOOMED (`../palette/ops.ts`), which is a page rather than a row and used
 * to be the one node in this app no pointer could mark, date or put away at
 * all — the heading has no `•••`. A subject is the two facts every verb here
 * actually reads (the record it was chosen at, and the node that record
 * shows), so both callers construct one and neither has to pretend to be the
 * other.
 */

import {
  isMirror,
  MARKS,
  type Node,
  type LocatedRegular,
  type Row,
  type Situated,
  type Status,
} from "@olai/format"
import type { Edit, Shelf } from "@olai/surface"

import { datePick } from "../date/pick.ts"
import { repeatPick } from "../date/repeat.ts"
import { type Relation, RELATIONS } from "../edges/relation.ts"
import { pinnedAt } from "../pins/pins.ts"
import { customEntries } from "../props/drawer.ts"
import { atNode, hrefOf } from "../routes.ts"
import { trashQuestion } from "../trash/question.ts"

/**
 * What a write verb is ABOUT: one record, and whatever it shows.
 *
 * The distinction is the rule the whole editor is built on, and it is exactly
 * why this is two fields rather than one id. A mark and a date are facts about
 * the node a row SHOWS, so a mirror marks its target; retiring a placement is
 * about the row's OWN record, which is what a placement is. Anything that
 * draws a node can answer both.
 */
export interface Subject {
  /** The record the verb was chosen at — a row's own, or a zoomed node
   *  itself. `unmirror` is the one verb that names this. */
  readonly record: Node
  /** The regular node at the end of the chain, or `undefined` for a placement
   *  that draws nothing (a chain that died, one that closed a loop). */
  readonly shows: LocatedRegular | undefined
  readonly status: Status | undefined
}

/** The subject a ROW is — what the `•••` menu asks about. */
export const subjectOfRow = (row: Row): Subject => ({
  record: row.at.node,
  shows: row.kind === "node" || row.kind === "mirror" ? row.shows : undefined,
  status: row.status,
})

/**
 * The subject a ZOOMED PAGE is — what the palette asks about.
 *
 * A zoom always lands on a regular node however it was addressed
 * (`@olai/format`'s `zoom` follows the chain), so the record and what it shows
 * are the same node here, and the placement verb is correctly never offered:
 * the reader is looking at the node, not at a line standing for it.
 */
export const subjectOfZoom = (zoomed: Situated): Subject => ({
  record: zoomed.shows.node,
  shows: zoomed.shows,
  status: zoomed.status,
})

/**
 * What choosing a verb DOES — two answers rather than one, because one entry
 * has a question of its own to ask first.
 *
 * Almost all of them are an edit, known the moment the menu is drawn: the mark
 * to put on, the date to take off, the recurrence to stop, the placement to
 * retire. `Set date…`, `Set repeat…`, the two edge verbs and `Move to…` are the
 * exceptions, and none of them is an exception to the SEAM — what each
 * eventually sends is the same edit its other door sends, through the same
 * gate — only to the timing: a date, a rule, a target and a destination are
 * values somebody has to choose, and a menu entry cannot carry one. So each
 * opens the row's own panel ({@link ../date/DatePicker.tsx},
 * {@link ../date/RepeatPicker.tsx}, {@link ../edges/EdgePanel.tsx},
 * {@link ../move/MovePicker.tsx}) and the write happens a gesture later.
 *
 * A tagged union rather than an optional `edit`, for the reason the wire's own
 * anchors are one: "an entry with no edit" is spellable by accident, and the
 * arm that opens something is a thing a reader should be able to find.
 */
export type Does =
  | { readonly kind: "edit"; readonly edit: Edit }
  | { readonly kind: "pick-date" }
  /** The REPEAT RULE, and `pick-date`'s shape for `pick-date`'s reason: which
   *  rule is a choice somebody has to make, and a menu entry cannot carry one.
   *  What eventually goes is the same `repeat` edit the picker's own button
   *  sends, through the same gate. */
  | { readonly kind: "pick-repeat" }
  /** The two EDGE verbs, and they are `pick-date`'s shape for `pick-date`'s
   *  reason: a target is a node somebody has to find, and a menu entry cannot
   *  carry one. What eventually goes is the same `see` / `after` edit the `×`
   *  on a drawn reference sends, through the same gate. WHICH relation the
   *  panel is about travels with the arm, so the two entries are one code path
   *  rather than two that could drift. */
  | { readonly kind: "pick-edge"; readonly relation: Relation }
  /** WHERE THIS ROW GOES, and `pick-date`'s shape for `pick-date`'s reason: a
   *  destination is a node somebody has to find in a set too big to scroll, and
   *  a menu entry cannot carry one. What eventually goes is the same `under`
   *  edit ⌘⇧M's picker sends, through the same gate (`../move/`). */
  | { readonly kind: "pick-move" }
  /**
   * A PROPERTY, which is `pick-date`'s shape for `pick-date`'s reason: a key
   * and a value are things somebody has to type, and a menu entry cannot carry
   * them.
   *
   * `editing` is the property being changed, or `null` for one being added — so
   * `Add property…` and `Edit pr…` are one code path with one panel, and the
   * panel is TOLD what it is editing rather than looking it up again off a row
   * it does not have.
   */
  | {
    readonly kind: "pick-prop"
    readonly editing: { readonly key: string; readonly value: string } | null
  }

/** The ordinary answer, at the site that gives it — so the list below reads as
 *  a list of verbs rather than a list of wrappers. */
const sends = (edit: Edit): Does => ({ kind: "edit", edit })

/** One write the menu offers: what it is called, what it does, and what it
 *  asks first — if it asks anything. */
export interface Verb {
  readonly id: string
  readonly label: string
  /** What choosing it does. A VALUE: the wire, the refusal, the line that says
   *  so and the picker are all `./actions.ts`'s and `../writes.ts`'s. */
  readonly does: Does
  /** The question the menu puts in its own panel before sending, for the one
   *  verb that takes a branch away. Absent means "just do it", which is every
   *  other verb here: they are each one op, and each one has an inverse or an
   *  obvious way back. */
  readonly confirm?: string
}

/** The three marks in MENU order, which is the order a task moves through
 *  rather than {@link MARKS}' precedence order — a reader looking for "start
 *  this" should not have to read past "finish it". `Complete` is Workflowy's
 *  word for the same gesture `Ctrl+Enter` performs. */
const MARK_LABEL: ReadonlyArray<readonly [Status, string]> = [
  ["todo", "Mark todo"],
  ["doing", "Mark doing"],
  ["done", "Complete"],
]

export const writeVerbs = (
  subject: Subject,
  /** How many records hang under the node this subject shows, IN THE SET — the
   *  one question a subject cannot answer, and the number the archive's confirm
   *  has to name. It rides on the row now (`@olai/format`'s `Row.under`),
   *  counted where the set is, because the browser stopped holding one
   *  (`docs/brainstorming/vault-in-browser.md`). `undefined` only while a
   *  page's first reading is still arriving, which is a moment no row is drawn
   *  in — and the one verb that asks is then not offered rather than offered
   *  with a number nobody checked. */
  under: number | undefined,
  /** The shelf, as the server answered it — the other question a subject
   *  cannot answer: whether this node's page is already a door in the sidebar
   *  (`../pins/answered.tsx`). A SECOND value rather than a field on the first
   *  because it is a second reading, and one of them no longer comes from the
   *  browser's copy of anything. */
  shelf: Shelf,
): ReadonlyArray<Verb> => {
  const verbs: Array<Verb> = []
  // The node this subject draws: the mark it carries, the date it has. A
  // placement that shows nothing has neither — but it is still a record, so
  // the placement verb below applies to it.
  const shown = subject.shows

  if (shown !== undefined) {
    // THE SHELF, and it is FIRST among the writes for the reason the divider
    // above them exists at all: the order of this list is a fence, and the
    // entry a hand reaches for most often should not sit next to the one that
    // takes a subtree away.
    //
    // ONE ENTRY WITH TWO LABELS, because pinning is a STATE rather than an
    // event (`../pins/pinning.ts`): the shelf either holds this node's page or
    // it does not, and a menu offering both at once would make a reader choose
    // between two words while looking at a row that already knows which one
    // applies.
    //
    // It names the node the row SHOWS rather than the record standing there —
    // the rule a mark and a date already follow. A pin is a door to a PAGE,
    // and a mirror's page is its target's; storing the placement's id instead
    // would leave a pin that stops resolving the day somebody retires that
    // placement, which is a write about a line and not about the shelf.
    const pinned = pinnedAt(shelf, atNode(shown.node.id))
    verbs.push(
      pinned === undefined
        ? {
          id: "pin",
          label: "Pin to sidebar",
          does: sends({ verb: "pin", at: hrefOf(atNode(shown.node.id)) }),
        }
        : {
          id: "unpin",
          label: "Unpin from sidebar",
          // The pin's OWN node, which is the one thing on the shelf this verb
          // is about — never the node it opens. Archived rather than erased:
          // that is the removal the set has, and it is what makes an unpin
          // undoable and reversible from the Trash.
          does: sends({ verb: "trash", id: pinned.id }),
        },
    )
    // The mark it already carries is not offered again: putting it back is the
    // one mark request the ops layer refuses for asking about nothing
    // ("already done"), and an entry whose only outcome is that sentence is an
    // entry that teaches nobody anything. WHICH mark that is is not lost by
    // leaving it out — the row's own checkbox and tone are three pixels away,
    // and they are where every other reading of it comes from.
    for (const [mark, label] of MARK_LABEL) {
      if (subject.status === mark) continue
      verbs.push({
        id: `mark-${mark}`,
        label,
        does: sends({ verb: "mark", id: shown.node.id, mark }),
      })
    }
    if (subject.status !== undefined) {
      verbs.push({
        id: "clear-mark",
        label: "Clear mark",
        does: sends({ verb: "mark", id: shown.node.id, mark: null }),
      })
    }
    // A node's DATE, in two entries — and only the second of them writes on
    // the spot.
    //
    // Setting one has to ask which day, which is why this entry opens the
    // row's picker instead of carrying an edit (`../date/DatePicker.tsx`);
    // the ellipsis is what says so, the way it does in every menu. It is
    // offered on a dated row too, under the other of its two names: the pill
    // on the row opens the same picker, and a menu that could only take a date
    // OFF would be the affordance a mouse has for changing one hiding behind a
    // badge nobody has been told is a control.
    //
    // CLEARING keeps the verb #124 gave it, unchanged — and it is now the same
    // CONSTRUCTOR as well as the same words: an emptied box is a pick of
    // nothing, so this entry IS `datePick(id, "")` rather than a second literal
    // that happens to agree with it (`../date/pick.ts`). The two doors could
    // only ever have disagreed silently — the ops layer reads `""` and `null`
    // as the same disk effect — so the one spelling is the only thing that can
    // hold "one way to say no date" up.
    verbs.push({
      id: "set-date",
      label: shown.node.date === undefined ? "Set date…" : "Change date…",
      does: { kind: "pick-date" },
    })
    if (shown.node.date !== undefined) {
      verbs.push({
        id: "clear-date",
        label: "Clear date",
        does: sends(datePick(shown.node.id, "")),
      })
      // THE REPEAT RULE, and it is offered ONLY on a dated row — which is the
      // one place this menu fences a write rather than offering it and letting
      // the ops layer answer. It is not a policy of the menu's: the format
      // refuses a `repeat` with no `date` to repeat FROM, per line, so the
      // entry over an undated row is an affordance whose only outcome is that
      // refusal. `Set date…` is directly above it, which is the thing to do
      // first and the thing this menu already offers.
      //
      // Two entries under it for the same reason the date has two: choosing a
      // rule has to ask WHICH, so that entry opens the row's picker, and
      // stopping is exact and writes on the spot — through the same
      // constructor the picker's empty option sends (`../date/repeat.ts`).
      verbs.push({
        id: "set-repeat",
        label: shown.node.repeat === undefined ? "Set repeat…" : "Change repeat…",
        does: { kind: "pick-repeat" },
      })
      if (shown.node.repeat !== undefined) {
        verbs.push({
          id: "clear-repeat",
          label: "Stop repeating",
          does: sends(repeatPick(shown.node.id, "")),
        })
      }
    }
    // THE PROPERTIES: one entry that adds one, and a pair per property the node
    // already carries.
    //
    // WHICH properties those are is the DRAWER's answer, asked here rather than
    // re-derived (`../props/drawer.ts`), and it is the custom half only. The
    // node's own facts are drawn in that drawer too and have no entries here:
    // each of them has a verb of its own — the mark section above, `Change
    // date…`, the two edge verbs below — and `set_prop` refuses every one of
    // them by name, so an entry would be an affordance leading to a refusal.
    //
    // Editing is not offered for a key holding a LIST, and the drawer's own
    // note says why: the editor writes text, so a key holding three values
    // would come back as one string with commas in it. Removing one is exact
    // whatever it held, so that half is offered on every line.
    verbs.push({
      id: "prop-add",
      label: "Add property…",
      does: { kind: "pick-prop", editing: null },
    })
    for (const entry of customEntries(shown.node)) {
      if (!entry.listed) {
        verbs.push({
          id: `prop-edit-${entry.key}`,
          label: `Edit ${entry.key}…`,
          does: { kind: "pick-prop", editing: { key: entry.key, value: entry.value } },
        })
      }
      verbs.push({
        id: `prop-remove-${entry.key}`,
        label: `Remove ${entry.key}`,
        does: sends({ verb: "prop", id: shown.node.id, key: entry.key, value: null }),
      })
    }
    // THE TWO EDGES, and they are offered on every node rather than only on one
    // that already carries some: naming what a node points at is a thing you do
    // to a node that says nothing yet, and the panel each opens is where both
    // halves live — what it says now, with an `×` on each, and the search that
    // adds one (`../edges/EdgePanel.tsx`).
    //
    // ALWAYS BOTH, and never narrowed by what would be refused: an `after` that
    // would close a loop is the ops layer's sentence to say, naming the loop,
    // which is what a person needs and exactly what an agent gets. Hiding the
    // entry would be this menu teaching a rule the app does not have — the same
    // argument that keeps `Mark todo` on a finished row.
    for (const one of RELATIONS) {
      verbs.push({
        id: `edge-${one.relation}`,
        label: one.verb,
        does: { kind: "pick-edge", relation: one.relation },
      })
    }
  }

  // MOVE TO…, and it is offered on EVERY row — a node's own and a placement
  // alike, which is where it parts from the two verbs below it. It names the
  // ROW's own record, so a mirror moves as the placement it is and the node it
  // stands for stays where it lives; that is the same rule `Tab` and a drag
  // already follow, and the reason the split those two make (a duplicate or an
  // archive through a placement would touch a file the reader is not looking
  // at) does not apply here: moving this line moves this line.
  //
  // It is the `•••` door onto ⌘⇧M — and the ONLY door on a phone, where there
  // is no keyboard to press a chord on. `pick-date`'s shape for `pick-date`'s
  // reason: a destination is a node somebody has to find, and a menu entry
  // cannot carry one.
  verbs.push({
    id: "move-to",
    label: "Move to…",
    does: { kind: "pick-move" },
  })

  // A PLACEMENT can be retired, and the question is asked of the RECORD rather
  // than of what the row managed to draw — so the two degenerate kinds (a
  // chain that died, one that closed a loop) are covered by construction. That
  // is a fence this file does not have rather than a rescue it can promise: a
  // set holding a mirror of nothing is a set the validator refuses, so the
  // page shows the error view and there is no row to open a menu on. What this
  // does guarantee is that the day such a row IS drawable, the verb for it is
  // already the right one — and that nothing here has to ask a placement what
  // it shows in order to offer to remove it.
  if (isMirror(subject.record)) {
    verbs.push({
      id: "remove-placement",
      label: "Remove this placement",
      does: sends({ verb: "unmirror", id: subject.record.id }),
    })
  } else if (shown !== undefined) {
    // A COPY of this row and everything under it, as the sibling below.
    //
    // Drawn on a node's own row and not on a mirror of it — the same split the
    // put-away below makes, and the same reason read once more: what a
    // placement offers is retiring the placement, and duplicating through one
    // would copy a subtree that lives somewhere else, out of sight, on a click
    // that reads as being about this line. The verb therefore names the ROW's
    // own record, which in this branch IS the node it shows.
    //
    // NO CONFIRM. Every other structural verb in this menu that asks one takes
    // something away; this one only adds, and ⌘Z takes it back.
    verbs.push({
      id: "duplicate",
      label: "Duplicate",
      does: sends({ verb: "duplicate", id: subject.record.id }),
    })

    // The put-away is the one verb here whose question is about the SET —
    // how much the archive would move — so it is not offered at all in the
    // frame before the first snapshot arrives, where a count nobody checked
    // would be worse than a missing entry. The verb above needs no index, and
    // is drawn in that frame like every other one.
    if (under === undefined) return verbs

    // It is drawn on a node's own row and not on a mirror of it,
    // which is the same split as the verb above rather than a missing case:
    // the reader is looking at a placement, and the verb for a placement is
    // retiring it. Archiving from here would put away a subtree that lives
    // somewhere else, out of sight, on a click that reads as being about this
    // line. The entry SPEAKS Trash — the human-facing name for the archive
    // (`../trash/TrashPage.tsx`) — while the id below, the wire verb and the
    // op stay `archive`: the file is still `_olai/Trash.olai` and the agent's
    // tool is still `trash_node`; only the surface a person reads renames.
    verbs.push({
      id: "trash",
      label: "Move to Trash",
      does: sends({ verb: "trash", id: shown.node.id }),
      // Counted over the SET rather than over this row's children: what the
      // write moves is not what the page happens to be drawing (`./subtree.ts`).
      //
      // The SENTENCE is the Trash's own (`../trash/question.ts`) rather than
      // this file's: the human's 2026-08-12 ruling is about the TRASH, and a
      // multi-selection's Move to Trash makes the same promise about the same
      // op. Two spellings of it could only ever drift.
      confirm: trashQuestion({ kind: "row", title: shown.node.title }, under),
    })
  }

  return verbs
}
