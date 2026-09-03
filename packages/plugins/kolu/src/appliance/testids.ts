/**
 * WHAT KOLU DRAWS — the terminal door's test ids, this directory's half of the
 * tenant's table.
 *
 * They split along the RENDERER split, which is the only line that makes sense:
 * a scenario asserting on the terminal row is asserting on what the APPLIANCE
 * renders, and the pill's ids next door are what OLAI renders about it. The
 * split was a package wall until the appliance fold and is a module boundary
 * now; what did not change is which ids are whose.
 *
 * `TESTID.padi` is the pill's and lives in `../testids.ts` with it. `prop` and
 * `propValue` stay in `@olai/web` — they are the generic property drawer's, and
 * a block here wears them because a block must wear the run's contract, not
 * because it owns them.
 *
 * ## Why these are exported at all
 *
 * Same reason web's are: a scenario and a component must not spell the same
 * string twice. There is ONE door out of this package (`./testids`, which is
 * `../testids.ts`) and it spreads this table into its own; the suite reaches
 * that through `@olai/plugin-api/testids`, which is the only package allowed to
 * name a tenant. This module imports nothing, and must not — a testid door that
 * pulled a component would put SolidJS and an emulator on the graph of a
 * cucumber process with no browser in it.
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
