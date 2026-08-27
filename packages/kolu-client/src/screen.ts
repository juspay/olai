/**
 * ONE READ OF ONE SCREEN — rung 2, and the whole of what a click costs.
 *
 * A passthrough to padi's `screen.text` with two things added, both of them
 * olai's own business rather than padi's: the TAIL, and the two refusals.
 *
 * ## The tail is taken HERE, and the window is not used at all
 *
 * padi's `screen.text` takes `startLine`/`endLine`, and they are ABSOLUTE line
 * numbers into the scrollback — `startLine` is "first line to capture, 0-based,
 * defaults to the start of scrollback", and kaval's only clamp is low-side
 * (`getScreenText`: `end = min(buffer.length, endLine ?? buffer.length)`,
 * `start = max(0, startLine ?? 0)`). So there is no way to spell "the last N
 * lines" in that window without already knowing the buffer length, and a caller
 * that passes `startLine: N` hoping for a tail gets:
 *
 *   - the EMPTY STRING for any terminal shorter than N — `start > end`, no
 *     lines, and the pane draws a legitimate-looking empty snapshot. That is
 *     the common case (a fresh lane) drawing a lie, which is how this module
 *     shipped and what pi's review caught;
 *   - lines N..end for a longer one — not the last N, and asking for MORE
 *     lines returns FEWER.
 *
 * kaval's buffer reader does have a `tail` extent (`resolveScreenExtent`'s
 * `{ kind: "tail" }`), and padi's `screen.text` does not expose it. Until it
 * does, the tail is taken on THIS side — which is not a workaround but the
 * arrangement kolu's own MCP face already uses for the same verb
 * (`kolu-mcp/screenText.ts`: "the slice happens here, beside the padi hop —
 * the expensive wire is MCP-host↔agent, and that carries only the tail"). It
 * reads identically here: the padi hop is a unix socket on this machine, and
 * the expensive wire is the one to the browser, which carries only the tail.
 *
 * WHAT IT COSTS, said plainly: the whole rendered buffer crosses the local
 * socket per click. That is what the upstream ask removes, and it is filed
 * rather than worked around further.
 *
 * ## Why the trailing blank rows go first
 *
 * A rendered buffer ends in the empty viewport below the cursor. Take the last
 * six lines of a fresh shell naively and you get six blank lines — a real bug
 * kolu caught on its own MCP face, which is why its `tailLines` drops the
 * trailing whitespace run before slicing.
 *
 * That fold WAS written out here, because the only copy of it lived in the
 * daemon package this one exists not to install. kolu#2219 moved it to
 * `@kolu/padi-client/screenTail`, a leaf, so the copy is deleted and the
 * function imported — which is the whole shape of this lane: the reason a
 * consumer restates something is almost always where it lives, not what it is.
 *
 * ## The two refusals
 *
 * `no-padi` and `no-terminal` are things a reader is owed in words, not faults
 * to log. Both are ordinary: the link can drop between a chip drawing and a
 * click landing, and a dormant terminal has no live mirror to read, which is
 * padi's own `TerminalNotFound` and the expected answer for a lane that
 * finished an hour ago.
 *
 * NOTHING IS SUBSCRIBED. That is the rung's promise, kept by there being no
 * state here at all: the pane holds what it was handed and the button asks
 * again.
 */

import { type Snapshot, SnapshotRefused } from "@olai/surface"
import { tailLines } from "@kolu/padi-client/screenTail"

/** Re-exported so this package's own tests pin kolu's fold rather than a
 *  copy of it — the point of the swap is that there is one implementation, and
 *  a test importing a different one would defeat it. */
export { tailLines }
import { Effect } from "effect"

/**
 * How much of the tail a pane gets when it does not say.
 *
 * A screenful and a bit: enough that the last command and its output are both
 * there. A DEFAULT and not a cap — a caller that asks for more gets more,
 * because the pane's refetch is where somebody deliberately wants a longer
 * look.
 */
export const DEFAULT_LINES = 120

/**
 * What this module needs of padi — so the tail and the refusals have a test
 * that runs without a daemon.
 *
 * `{ id }` AND NOTHING ELSE, and the narrowness is the point rather than
 * economy: padi's own input admits a window, this module deliberately never
 * sends one, and typing the seam at what olai actually passes is what stops a
 * later edit from reaching for the absolute line numbers again. The real face
 * (whose input has two more optional fields) satisfies this.
 *
 * `null` is "there is no padi", which is the link's state and not an error this
 * function invents: the caller holds the connection and knows.
 */
export type ScreenReader =
  | null
  | ((input: { id: string }) => Effect.Effect<string, unknown>)

/**
 * THE LAST `lines` LINES of a rendered screen, with the trailing run of
 * whitespace-only rows dropped first.
 *
 * A pure fold over padi's reply — see the header for why it is spelled here
 * rather than imported, and for the blank-tail bug it exists to avoid. Blank
 * lines BETWEEN content are kept verbatim: they are what the terminal printed.
 */
/** Read one terminal's screen, and keep its tail. */
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
  return read({ id: terminal }).pipe(
    Effect.map((text): Snapshot => ({
      text: tailLines(text, lines ?? DEFAULT_LINES),
      at: now(),
    })),
    // EVERY failure is the same news here, and that is not laziness: padi's
    // declared error for all three screen reads is `TerminalNotFound` (a
    // dormant record has no live mirror), and a transport failure on a link
    // that was connected a moment ago is the same sentence to the person
    // looking at the pane — this terminal cannot be read right now. What the
    // two would need separate arms for is a RETRY policy, and there is none:
    // the button is the retry.
    //
    // `catchCause` rather than `catch`, so a DEFECT lands here too. A far end
    // that fails with something its schema does not declare sends a defect
    // down the wire, and a defect that escaped this would be a call that never
    // settles — a pane stuck on "reading…" forever, which is the one outcome
    // worse than a refusal.
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
