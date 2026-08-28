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
 *   - `heartbeat` — no row, no state: "the watcher is alive". A feed with
 *     nothing on it and a dead watcher must not read alike.
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
 * The ONLY thing this module computes itself is the three sentences' shape.
 */

import { narrowAgentState, recencyText } from "@kolu/solid-dockrow/rowValues"

import type { KoluEvent } from "@olai/surface"

/** One line of the feed, folded. The rendering takes it whole. */
export interface EventLine {
  /** Whether the frozen pip was blocked on somebody when this fired — the one
   *  test every kolu surface reads for the violet emphasis. */
  readonly asking: boolean
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
  // THE PULSE: no row, so no pip, and the only words are the heartbeat's own.
  if (row === null) {
    return {
      asking: false,
      label: "",
      labelColor: "",
      words: "the watcher is alive",
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
    label: row.label,
    labelColor: row.labelColor,
    words,
    age,
    about: row.terminal,
  }
}
