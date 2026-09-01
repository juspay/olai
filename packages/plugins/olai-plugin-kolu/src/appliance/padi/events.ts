/**
 * WHAT ONE EVENT LINE SAYS — the words, as a pure function.
 *
 * The feed (`../props/EventsFeed.tsx`) is a log reader: each row is one
 * server-authored event, FROZEN — it shows what the terminal looked like the
 * moment it fired, not what it looks like now. This module is the whole of
 * the wording, out here rather than inside the component for
 * `../props/terminal.ts`'s reason: three kinds with an order between their
 * sentences is the shape that goes quietly wrong in a render function, and
 * the suite reads the words without standing up a DOM.
 *
 * ## The words, in one place
 *
 *   - `transition` — "has been waiting for input for 38m". The state is the
 *     BUCKET's word (`awaiting` / `waiting`); the duration is the hold's
 *     own clock.
 *   - `nag` — "still waiting for input for 38m". A hold that fired last
 *     interval and has not resolved; the words say nothing else has changed.
 *   - `heartbeat` — THE ARM IS GONE: the beat folds onto the pill
 *     (`./said.ts`'s `beatOf`), and a row with no terminal is skipped by
 *     the drawer's one hinge, `EventsFeed`'s filter. The kind survives
 *     on the wire's spelling for the ring before it learned the rule.
 *
 * ## Where the folds live, which is NOT here
 *
 * Two thirds of every line are kolu's own phrases and neither is re-spelled:
 * the AGE column is `recencyText`'s `ago` arm ("4m ago", "just now"), and
 * the HELD FOR duration is its `wait-chip` arm ("38m", "20h") — the capsule
 * format, stolen for a log line, which is two clocks and one vocabulary all
 * the way down (`@kolu/solid-dockrow/rowValues`). The BUCKET WORD is
 * `stateLabels`'s, lowercased; when the wire names a state this build does
 * not know, that fold keeps it too, and the sentence names it rather than
 * a neighbour.
 *
 * The WHO column is not this module's either, and it is the one that had to
 * LEAVE: `@olai/kolu-client/wire`'s `whoOf` folds `repo·label` in the Dock's
 * own spelling, and it is the same fold `olai-plugin-kolu`'s doorbell names
 * a row with in a plain-text sentence. It was spelled here as well until the
 * two spellings drifted; that function's header carries the story.
 *
 * The ONLY thing this module computes itself is the three sentences' shape.
 */

import { narrowAgentState, recencyText } from "@kolu/solid-dockrow/rowValues"

import type { KoluEvent } from "@olai/kolu-client/wire"
import { whoOf } from "@olai/kolu-client/wire"

/** One line of the feed, folded. The rendering takes it whole. */
export interface EventLine {
  /** Whether the frozen pip was blocked on somebody when this fired — the one
   *  test every kolu surface reads for the violet emphasis. */
  readonly asking: boolean
  /** THE WHO line, as the drawer writes it: `repo · label` when the frozen
   *  row carries a repo (kolu's own `repo·branch` spelling, the Dock's
   *  grouping answer in one breath), the plain label where nobody ever
   *  named one — the drawer never reads `label` raw, it reads
   *  `@olai/kolu-client/wire`'s `whoOf`. Blank on a heartbeat. */
  readonly who: string
  /** The frozen label — the intent line, else the branch, blank on a
   *  heartbeat. */
  readonly label: string
  /** Its ink. */
  readonly labelColor: string
  /** The sentence half — see the header. */
  readonly words: string
  /** The age column — kolu's own ago-phrase, or "" under a minute's
   *  truncation, as the fold gives it. */
  readonly age: string
  /** Which terminal this row is ABOUT, or `null` for the heartbeat. The
   *  full id, so a row's title can say what it could not fit. */
  readonly about: string | null
}

/** The state's own word, narrowed by kolu rather than spelled: the label
 *  a known state carries (`awaiting_user` reads "awaiting input"); an
 *  agent state this build's narrowing does not know falls to the BUCKET,
 *  which is already a word in the right vocabulary. Lowercased to sit
 *  inside a sentence. */
const stateWord = (agentState: string | null, state: string): string =>
  (narrowAgentState(agentState).label ?? state).toLowerCase()

export const eventLine = (event: KoluEvent, now: number): EventLine => {
  const row = event.row
  const atMs = Date.parse(event.at)
  // The tab's tick lags a fresh frame by up to its cadence — an event
  // younger than one tick would otherwise fold to a NEGATIVE age, which
  // `agoPhrase` reads as a dash. The fix at the SEAM rather than the fold:
  // the fold's `now` argument clamps to the event itself, so the youngest
  // row reads "just now" the way kolu's own phrase reads it.
  const age = recencyText("ago", atMs, Math.max(now, atMs))
  // A row WITH NO TERMINAL is the heartbeat the pill no longer reads —
  // the drawer folds it out before it gets here; treat a leak as nothing
  // to fold rather than as a lie to spell.
  if (row === null) {
    return {
      asking: false,
      who: "",
      label: "",
      labelColor: "",
      words: "",
      age,
      about: null,
    }
  }
  // THE HELD-FOR, frozen at FIRE time: a log line is a fact at a time,
  // and the `…for 38m` is the hold AS the event said it, not as the
  // reader's now stretches it. The wire GUARANTEES a `since` — the
  // watcher's own observation clock — so no row folds here without one.
  const held = recencyText("wait-chip", Date.parse(row.since), atMs)
  const word = stateWord(row.agentState, row.state)
  const words = event.kind === "nag"
    ? `still ${word} for ${held}`
    : `has been ${word} for ${held}`
  return {
    asking: row.pip.asking,
    who: whoOf(row.repo, row.label),
    label: row.label,
    labelColor: row.labelColor,
    words,
    age,
    about: row.terminal,
  }
}
