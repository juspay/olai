/**
 * What the `•••` menu may WRITE on a given row, as values.
 *
 * The catalog of write verbs, pure over the row the menu was opened on: which
 * entries a reader is offered, and the exact {@link Edit} each one sends. No
 * socket, no clipboard and no component — those are `./actions.ts`'s — so the
 * two decisions that live here are decidable in a unit test:
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
 */

import { ARCHIVE, type Derived, isMirror, MARKS, type Row, type Status } from "@olai/format"
import type { Edit } from "@olai/surface"

import { under } from "./subtree.ts"

/** One write the menu offers: what it is called, what it sends, and what it
 *  asks first — if it asks anything. */
export interface Verb {
  readonly id: string
  readonly label: string
  /** The one edit choosing it sends. A VALUE: what happens to it — the wire,
   *  the refusal, the line that says so — is `./writes.ts`'s. */
  readonly edit: Edit
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
  row: Row,
  /** The set's own indexes, for the one question a ROW cannot answer: how much
   *  an archive would move. `undefined` only while the first frame is still
   *  arriving, which is a moment no row is drawn in — and the one verb that
   *  asks is then not offered rather than offered with a number nobody
   *  checked. */
  derived: Derived | undefined,
): ReadonlyArray<Verb> => {
  const verbs: Array<Verb> = []
  // A row drawing a node: the mark it carries, the date it has. A placement
  // that shows nothing (a chain that died, one that closed a loop) has neither
  // — but it is still a record, so the placement verb below applies to it.
  const shown = row.kind === "node" || row.kind === "mirror" ? row.shows : undefined

  if (shown !== undefined) {
    // The mark it already carries is not offered again: putting it back is the
    // one mark request the ops layer refuses for asking about nothing
    // ("already done"), and an entry whose only outcome is that sentence is an
    // entry that teaches nobody anything. WHICH mark that is is not lost by
    // leaving it out — the row's own checkbox and tone are three pixels away,
    // and they are where every other reading of it comes from.
    for (const [mark, label] of MARK_LABEL) {
      if (row.status === mark) continue
      verbs.push({
        id: `mark-${mark}`,
        label,
        edit: { verb: "mark", id: shown.node.id, mark },
      })
    }
    if (row.status !== undefined) {
      verbs.push({
        id: "clear-mark",
        label: "Clear mark",
        edit: { verb: "mark", id: shown.node.id, mark: null },
      })
    }
    // The REMOVAL half of a node's date. Setting one is the `!` picker's
    // (`input-widgets`), which is a thing you type rather than a thing you
    // choose from a list; clearing is the half that has nowhere else to live,
    // and until now had nowhere at all.
    if (shown.node.date !== undefined) {
      verbs.push({
        id: "clear-date",
        label: "Clear date",
        edit: { verb: "date", id: shown.node.id, date: null },
      })
    }
  }

  // A PLACEMENT can be retired, and it is offered on every kind of one —
  // including the two that draw no node. A mirror whose target has gone is
  // exactly the row somebody wants to be rid of, and before this the only way
  // to be rid of it was to edit the file.
  if (isMirror(row.at.node)) {
    verbs.push({
      id: "remove-placement",
      label: "Remove this placement",
      edit: { verb: "unmirror", id: row.at.node.id },
    })
  } else if (shown !== undefined && derived !== undefined) {
    // ARCHIVE is drawn on a node's own row and not on a mirror of it, which is
    // the same split as the verb above rather than a missing case: the reader
    // is looking at a placement, and the verb for a placement is retiring it.
    // Archiving from here would put away a subtree that lives somewhere else,
    // out of sight, on a click that reads as being about this line.
    verbs.push({
      id: "archive",
      label: "Archive",
      edit: { verb: "archive", id: shown.node.id },
      // Counted over the SET rather than over this row's children: what the
      // write moves is not what the page happens to be drawing (`./subtree.ts`).
      confirm: archiveQuestion(shown.node.title, under(derived, shown.node.id)),
    })
  }

  return verbs
}

/**
 * What the menu asks before it archives — the human's ruling (2026-08-12), in
 * two halves that both matter.
 *
 * The BLAST RADIUS, because a subtree archive is the one menu verb whose reach
 * is bigger than the line it was chosen on, and a count is the only honest way
 * to say so on a row whose children may be collapsed.
 *
 * And WHERE IT GOES, because the word "archive" invites a reader to assume a
 * bin they can open, and there is no unarchive on any face yet
 * (`parity-unarchive`). The file is the restore path, so the file is named.
 */
const archiveQuestion = (title: string, rows: number): string =>
  rows === 0
    ? `Archive “${title}”? It goes to ${ARCHIVE} with its id kept — ` +
      `there is no unarchive yet, so bringing it back means editing that file.`
    : `Archive “${title}” and the ${rows === 1 ? "row" : `${rows} rows`} under it? ` +
      `They go to ${ARCHIVE} with their ids kept — there is no unarchive yet, ` +
      `so bringing them back means editing that file.`
