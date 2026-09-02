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
 * for are the two calls an agent makes (the consistency rule). A menu
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
  AGENT_PROP,
  customOf,
  customText,
  isMirror,
  MARKS,
  type Node,
  type LocatedRegular,
  type Row,
  sessionIn,
  type Situated,
  type Status,
} from "@olai/format"
import type { AgentChoice, Edit, Shelf } from "@olai/surface"

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
   * A PROPERTY somebody is about to name, which carries nothing at all — and
   * that is the difference from the three above.
   *
   * It used to be a `pick-prop` carrying what was being edited, because the
   * menu opened a panel and the panel had to be told. There is no panel: a
   * property is edited in the run of chips under the title, which already knows
   * every key and every value it draws, so the only thing left for a menu entry
   * to say is *open the add chip* — and it says that on the one node the run's
   * own `+` cannot be drawn on (see where this is pushed).
   */
  | { readonly kind: "add-prop" }
  /**
   * START THIS NODE AGENT'S SESSION — the one verb here that is not an edit at
   * all and does not open a panel either.
   *
   * It is two acts that only make sense together: open a conversation with the
   * engine this node's `agent-session` property names, then write the session
   * it opened back onto that property. A browser cannot do the second, because
   * `chat.newSession` answers with nothing and no tab can say which
   * conversation appeared; so what this arm carries is the ENGINE, and the
   * running of it is one procedure at the server, where both halves are in hand
   * (`@olai/surface`'s `chat.startAgentSession`).
   *
   * THE ENGINE TRAVELS ON THE ARM rather than being re-read where it is run,
   * for the reason every other arm carries its own value: the menu was drawn
   * against a revision, and the property could have moved by the time somebody
   * presses. What lands is then a session for the engine the entry said.
   */
  | { readonly kind: "start-agent"; readonly engine: string }

/** The ordinary answer, at the site that gives it — so the list below reads as
 *  a list of verbs rather than a list of wrappers. */
const sends = (edit: Edit): Does => ({ kind: "edit", edit })

/** A MACHINE WITH NO AGENT ON IT, which is the honest argument for a caller
 *  that cannot offer *start an agent session* anyway — `NO_PINS`' shape one
 *  question over (`../palette/ops.ts` says why it cannot matter there). */
export const NO_ENGINES: ReadonlyArray<AgentChoice> = []

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

/**
 * What each mark is CALLED in the menu, and where it sits.
 *
 * TWO FACTS PER MARK IN ONE TABLE, keyed by {@link Status}, so a fifth mark is
 * a missing key here — named by the compiler — rather than a mark that is
 * writable at every other door and simply absent from the one a mouse uses.
 * The list this replaced was an array of pairs and could not say that: a mark
 * left out of it compiled clean and was offered nowhere.
 *
 * `at` is MENU order, which is the order a task moves through rather than
 * {@link MARKS}' precedence order — a reader looking for "start this" should
 * not have to read past "finish it". `Complete` is Workflowy's word for the
 * same gesture `Ctrl+Enter` performs, and `Cancel` is the plain word for what
 * `Alt+Enter` performs: LAST, past the finishing verb, because calling work off
 * is the rarest of the four and the one nobody should reach by accident.
 */
const MARK_MENU = {
  todo: { at: 0, label: "Mark todo" },
  doing: { at: 1, label: "Mark doing" },
  done: { at: 2, label: "Complete" },
  cancelled: { at: 3, label: "Cancel" },
} as const satisfies Record<Status, { readonly at: number; readonly label: string }>

/** That table, read in its own order — off {@link MARKS}, so the entries are
 *  the format's list and this file decides only what each is called and where
 *  it goes. */
const MARK_LABEL: ReadonlyArray<readonly [Status, string]> = MARKS
  .map((mark) => [mark, MARK_MENU[mark]] as const)
  .sort(([, a], [, b]) => a.at - b.at)
  .map(([mark, entry]) => [mark, entry.label] as const)

export const writeVerbs = (
  subject: Subject,
  /** How many records hang under the node this subject shows, IN THE SET — the
   *  one question a subject cannot answer, and the number the archive's confirm
   *  has to name. It rides on the row now (`@olai/format`'s `Row.under`),
   *  counted where the set is, because the browser stopped holding one
   *  (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`). `undefined` only while a
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
  /** WHICH AGENTS THIS MACHINE HAS — the third question a subject cannot
   *  answer, and the one that is not about the vault at all
   *  (`../agents/answered.tsx`). It is what *start an agent session* picks from
   *  on a node that names no engine of its own; {@link NO_ENGINES} is the
   *  honest argument for a caller that cannot offer that verb anyway. */
  engines: ReadonlyArray<AgentChoice> = NO_ENGINES,
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
    // ANY NODE THAT DOES NOT ALREADY HAVE A SESSION, and the verb that gives it
    // one. The press WRITES the property; it does not require one.
    //
    // The human, testing the deployed head on 2026-09-02: the ruling was *the
    // `•••` should get a menu item allowing me to start an agent session*, and
    // an item that appeared only where somebody had already typed
    // `agent-session: claude` by hand is the gesture asking to be performed
    // before it will offer itself. So the fence is one arm now, and it is the
    // only one the ruling names:
    //
    //   - a node whose property already names a SESSION is offered nothing.
    //     Replacing a live conversation owes a person a sentence about what
    //     happens to the transcript ("memory is the subtree; the transcript
    //     becomes history"), and that sentence does not fit on a menu entry: it
    //     is the panel's *fresh session*, drawn with the label beside it
    //     (`../chat/NodeSessions.tsx`), which runs this same procedure on a node
    //     that already has one.
    //   - everything else is offered it, bare nodes included.
    //
    // WHICH ENGINE, in the order a person would expect to be asked:
    //
    //   - the node's OWN, where its property names one. It said which agent it
    //     is; nothing here gets to second-guess that, and this is the case
    //     where there is nothing to choose however many agents are installed.
    //   - otherwise EVERY AGENT THIS MACHINE HAS, one entry each. With one
    //     installed that is one entry and no ask, which is the ruling's own
    //     words; with several the menu IS the ask — a list of choices is what a
    //     menu already is, so this needs no panel, no picker and no second
    //     gesture, and it is the shape `MARK_MENU` above already takes.
    //   - with NONE installed there is no entry, because there is nothing to
    //     start a session with and an entry whose only outcome is that sentence
    //     teaches nobody anything.
    //
    // The label carries the agent's name only when there is a choice to make.
    // Naming it on a machine with one agent would be answering a question
    // nobody was asked, in the one place a menu has no room for it.
    //
    // It names the node the row SHOWS, the rule a mark and a pin already
    // follow: a mirror is a placement, the property is on the record it stands
    // for, and the roster answers with that record's id.
    const held = sessionIn(customText(shown.node, AGENT_PROP) ?? "")
    if (held?.session == null) {
      const choices: ReadonlyArray<AgentChoice> = held === null
        ? engines
        : [{ id: held.engine, name: held.engine }]
      for (const choice of choices) {
        verbs.push({
          id: `start-agent-${choice.id}`,
          label: choices.length === 1
            ? "Start an agent session"
            : `Start an agent session — ${choice.name}`,
          does: { kind: "start-agent", engine: choice.id },
        })
      }
    }
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
    // THE PROPERTIES: ONE entry, and only on a node that carries none.
    //
    // This used to be `Add property…` plus an `Edit <key>…` and a
    // `Remove <key>` PER PROPERTY — so a node carrying eight facts had sixteen
    // menu entries about them, and the menu got longer every time somebody
    // wrote something down. Every one of those is gone: a property is edited in
    // the RUN OF CHIPS under the title now, where it is read
    // (`../props/PropsDrawer.tsx`), and the `+` at the end of that run is the
    // door onto adding one. Two doors onto one write is the drift this repo
    // keeps collapsing.
    //
    // What is left is the one case the `+` cannot reach: a node with no
    // properties has no run for a `+` to sit at the end of, and drawing an
    // otherwise-empty run under every row of a tree would cost a line per
    // title. So the entry is offered exactly when the run is empty — one door
    // at a time, never two — and what it opens is that same editor rather than
    // a panel of its own.
    //
    // WHETHER the run is empty is the DRAWER's answer, asked here rather than
    // re-derived (`../props/drawer.ts`), and it is the custom half only. The
    // node's own facts are drawn in that run too and are not writable there or
    // here: each has a verb of its own — the mark section above, `Change
    // date…`, the two edge verbs below — and `set_prop` refuses every one of
    // them by name.
    if (customEntries(customOf(shown.node)).length === 0) {
      verbs.push({
        id: "prop-add",
        label: "Add property…",
        does: { kind: "add-prop" },
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
