/**
 * THE TERMINAL DOOR'S TEST IDS — this package's half of olai's testid table.
 *
 * They split along the renderer split, which is the only line that makes sense:
 * a scenario asserting on the terminal row is asserting on THIS package's
 * output, and an id it can only reach through `@olai/web` would be a suite
 * reading one package's DOM through another package's door.
 *
 * `TESTID.padi` deliberately STAYS in web, with the pill it names: the header
 * readout's chrome is olai's, and only its words came here (`./padi/said.ts`).
 * `prop` and `propValue` stay too — they are the generic property drawer's, and
 * this package's block wears them because a block must wear the run's contract,
 * not because it owns them.
 *
 * ## Why these are exported at all
 *
 * Same reason web's are: a scenario and a component must not spell the same
 * string twice. The suite reaches this door through the package's `./testids`
 * entry, and `packages/tests`' import sweep asserts that the entry stays
 * NAMES-ONLY — no component ever crosses into the suite through it.
 */
export const TESTID = {
  /** THE TERMINAL DOOR's row — kolu's own Dock row, drawn where the `terminal`
   *  property is (`./props/TerminalDoor.tsx`). The row's own attribute contract
   *  is kolu's (`[data-dock-row]`, `data-bucket`, `data-agent-state`) and is
   *  asserted through it rather than restated here; what olai owns is this
   *  wrapper and `data-terminal`, the value the property holds. */
  terminalBlock: "terminal-block",
  /** What is drawn IN THE ROW'S PLACE when there is none — the sentence, and
   *  the only thing that says why (`./props/terminal.ts`). Its presence is the
   *  assertion: a row and a reason are never both on screen. */
  terminalSays: "terminal-says",
  /** The pane the ROW opens. Present only while open; one per block. */
  terminalPane: "terminal-pane",
  /** THE LIVE TAG — the one word that separates this pane from the snapshot it
   *  replaced, and the assertion a scenario makes that a window is a window.
   *  Present only on a pane that is attached. */
  terminalLive: "terminal-live",
  /** The screen text inside it, verbatim, or the refusal in its place.
   *  `data-state` is `attached` / `refused`. */
  terminalScreen: "terminal-screen",
  /** Read it again — kept for the snapshot face; nothing wears it today. */
  terminalRefetch: "terminal-refetch",
  /** THE EVENTS FEED — the list a Padi press opens (`./props/EventsFeed.tsx`).
   *  `data-kind` per row is the event's own word, and `data-asking` is the
   *  wire's frozen draw; the scenario asserts on THOSE rather than re-asking
   *  what a violet means. */
  eventsFeed: "events-feed",
  /** ONE ROW of it — the frozen draw. */
  eventsRow: "events-row",
  /** The sentence half under a frozen row — "has been waiting for input for
   *  38m". The words are the server-fold's words; this door is how a test
   *  stops spelling them twice. */
  eventsWords: "events-words",
  /** What the feed says where the list is empty — the link's own sentence in
   *  place of a blank. */
  eventsEmpty: "events-empty",
} as const
