/**
 * What a surface may WRITE about one node, as values.
 *
 * The catalog of write verbs, pure over the SUBJECT it was asked about: which
 * entries a reader is offered, and the exact {@link Edit} each one sends — or,
 * for the three whose value a person still has to choose, which panel the row
 * opens ({@link Does}: the date picker, and the two edge panels). No socket,
 * no clipboard and no component —
 * those are `./actions.ts`'s — so the two decisions that live here are
 * decidable in a unit test:
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
  type Derived,
  isMirror,
  MARKS,
  type Node,
  type LocatedRegular,
  type Row,
  type Situated,
  type Status,
} from "@olai/format"
import type { Edit } from "@olai/surface"

import { datePick } from "../date/pick.ts"
import { type Relation, RELATIONS } from "../edges/relation.ts"
import { archiveQuestion } from "../trash/question.ts"
import { under } from "./subtree.ts"

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
 * to put on, the date to take off, the placement to retire. `Set date…` and the
 * two edge verbs are the exceptions, and none of them is an exception to the
 * SEAM — what each eventually sends is the same edit its other door sends,
 * through the same gate — only to the timing: a date and a target are values
 * somebody has to choose, and a menu entry cannot carry one. So each opens the
 * row's own panel ({@link ../date/DatePicker.tsx},
 * {@link ../edges/EdgePanel.tsx}) and the write happens a gesture later.
 *
 * A tagged union rather than an optional `edit`, for the reason the wire's own
 * anchors are one: "an entry with no edit" is spellable by accident, and the
 * arm that opens something is a thing a reader should be able to find.
 */
export type Does =
  | { readonly kind: "edit"; readonly edit: Edit }
  | { readonly kind: "pick-date" }
  /** The two EDGE verbs, and they are `pick-date`'s shape for `pick-date`'s
   *  reason: a target is a node somebody has to find, and a menu entry cannot
   *  carry one. What eventually goes is the same `see` / `after` edit the `×`
   *  on a drawn reference sends, through the same gate. WHICH relation the
   *  panel is about travels with the arm, so the two entries are one code path
   *  rather than two that could drift. */
  | { readonly kind: "pick-edge"; readonly relation: Relation }

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
  /** The set's own indexes, for the one question a SUBJECT cannot answer: how
   *  much an archive would move. `undefined` only while the first frame is
   *  still arriving, which is a moment no row is drawn in — and the one verb
   *  that asks is then not offered rather than offered with a number nobody
   *  checked. */
  derived: Derived | undefined,
): ReadonlyArray<Verb> => {
  const verbs: Array<Verb> = []
  // The node this subject draws: the mark it carries, the date it has. A
  // placement that shows nothing has neither — but it is still a record, so
  // the placement verb below applies to it.
  const shown = subject.shows

  if (shown !== undefined) {
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
  } else if (shown !== undefined && derived !== undefined) {
    // The put-away is drawn on a node's own row and not on a mirror of it,
    // which is the same split as the verb above rather than a missing case:
    // the reader is looking at a placement, and the verb for a placement is
    // retiring it. Archiving from here would put away a subtree that lives
    // somewhere else, out of sight, on a click that reads as being about this
    // line. The entry SPEAKS Trash — the human-facing name for the archive
    // (`../trash/TrashPage.tsx`) — while the id below, the wire verb and the
    // op stay `archive`: the file is still `Archive.olai` and the agent's
    // tool is still `archive_node`; only the surface a person reads renames.
    verbs.push({
      id: "archive",
      label: "Move to Trash",
      does: sends({ verb: "archive", id: shown.node.id }),
      // Counted over the SET rather than over this row's children: what the
      // write moves is not what the page happens to be drawing (`./subtree.ts`).
      //
      // The SENTENCE is the Trash's own (`../trash/question.ts`) rather than
      // this file's: the human's 2026-08-12 ruling is about the ARCHIVE, and a
      // multi-selection's Move to Trash makes the same promise about the same
      // op. Two spellings of it could only ever drift.
      confirm: archiveQuestion(
        { kind: "row", title: shown.node.title },
        under(derived, shown.node.id),
      ),
    })
  }

  return verbs
}
