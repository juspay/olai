/**
 * ONE READ OF ONE SCREEN — rung 2, and the whole of what a click costs.
 *
 * A passthrough to padi's `screen.text` with two things added, both of them
 * olai's own business rather than padi's:
 *
 *   - THE ERGONOMIC. padi takes a WINDOW (`startLine`/`endLine`, absolute into
 *     the scrollback); what a pane wants is "the last N lines", and computing
 *     the window from that means knowing the buffer length — a second round
 *     trip for a question the daemon could answer in one. So olai's own verb
 *     takes a count and asks padi for the tail, and the arithmetic lives here
 *     rather than in the browser, where it would be a second copy of padi's
 *     line-numbering convention.
 *   - THE TWO REFUSALS. `no-padi` and `no-terminal` are things a reader is owed
 *     in words, not faults to log. Both are ordinary: the link can drop between
 *     a chip drawing and a click landing, and a dormant terminal has no live
 *     mirror to read, which is padi's own `TerminalNotFound` and the expected
 *     answer for a lane that finished an hour ago.
 *
 * NOTHING IS SUBSCRIBED. That is the rung's promise and it is kept by there
 * being no state here at all: the pane holds what it was handed and the button
 * asks again. Phase 6's live pane is a stream member with a refcount and a
 * different border; keeping this one a bare verb is what lets the two say
 * different things about what they are.
 */

import { type Snapshot, SnapshotRefused } from "@olai/surface"
import { Effect } from "effect"

/**
 * How much of the tail a pane gets when it does not say.
 *
 * A screenful and a bit: enough that the last command and its output are both
 * there, short enough that a frame is a few kilobytes. It is a DEFAULT and not
 * a cap — a caller that asks for more gets more, because the pane's refetch is
 * the one place somebody deliberately wants a longer look.
 */
export const DEFAULT_LINES = 120

/**
 * What this module needs of padi, as a function — so the arithmetic and the
 * refusals have a test that runs without a daemon.
 *
 * `null` is "there is no padi", which is the link's state and not an error this
 * function invents: the caller holds the connection and knows.
 */
export type ScreenReader =
  | null
  | ((input: { id: string; startLine?: number; endLine?: number }) => Effect.Effect<string, unknown>)

/**
 * Read one terminal's screen.
 *
 * The window: padi counts lines from the START of the scrollback, and there is
 * no negative index — so "the last N" is spelled by asking for a window whose
 * start is N back from the end, and the end is left ABSENT, which padi reads as
 * the buffer length. That means one call and no length lookup, at the cost of
 * this comment: `startLine` alone is the tail, and the number is how far back
 * it starts, not how many lines come out. A buffer shorter than N clamps at 0
 * on padi's side and the whole thing comes back, which is what a caller asking
 * for a hundred lines of a ten-line terminal means.
 */
export const screenText = (
  read: ScreenReader,
  terminal: string,
  lines: number | undefined,
  now: () => string,
): Effect.Effect<Snapshot, SnapshotRefused> => {
  if (read === null) {
    return Effect.fail(
      new SnapshotRefused({
        reason: "no-padi",
        says: "olai is not connected to a padi, so there is no screen to read.",
      }),
    )
  }
  const back = lines ?? DEFAULT_LINES
  return read({ id: terminal, startLine: Math.max(0, back) }).pipe(
    Effect.map((text): Snapshot => ({ text, at: now() })),
    // EVERY failure is the same news here, and that is not laziness: padi's
    // declared error for all three screen reads is `TerminalNotFound` (a
    // dormant record has no live mirror), and a transport failure on a link
    // that was connected a moment ago is the same sentence to the person
    // looking at the pane — this terminal cannot be read right now. What the
    // two would need separate arms for is a RETRY policy, and there is none:
    // the button is the retry.
    Effect.catchCause(() =>
      Effect.fail(
        new SnapshotRefused({
          reason: "no-terminal",
          says: "padi has no live screen for this terminal — it has been closed, or it is asleep.",
        }),
      )
    ),
  )
}
