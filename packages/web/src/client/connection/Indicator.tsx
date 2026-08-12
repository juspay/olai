/**
 * The connection pill: is this page still talking to a server?
 *
 * It is small, it is always there, and it is the only thing on screen that
 * reports on the connection rather than on the outlines. Always THERE is the
 * point — an indicator that only appears when something is wrong cannot be
 * trusted when it is absent, because "healthy" and "not rendered" look the
 * same. Green is a claim this page keeps making.
 *
 * WHERE it goes is the layout's to say, not this component's. There is one
 * answer now: the app header (`../AppHeader.tsx`), beside the agent toggle and
 * the theme picker, on every shape of the app — including the error report and
 * the waiting page, which are exactly the pages whose connection a reader wants
 * to know about most of all. The two-home layout (sidebar footer, or a corner
 * when there was no sidebar) collapsed with the header; a pill fixed to the
 * corner of a page with an outline on it used to sit on the last line of
 * whatever scrolled under it.
 *
 * The label truncates rather than forcing the header to wrap: on a 390pt phone
 * `server restarted` / `reconnecting` / `connecting` are wider than the room
 * left beside the wordmark, and a wrap inside a fixed-height bar clipped the
 * first row off the top of the viewport. The full sentence still rides `title`.
 *
 * It truncates against its OWN cap and never against the bar, which is the
 * difference `shrink-0` makes and the reason it is there. The header's rule is
 * that this label is the LAST thing in it to give way (`../AppHeader.tsx`):
 * `live` is four letters, it is the claim a reader scans hardest, and a bar
 * that squeezed it to `l…` while a theme name beside it stayed whole is a bar
 * that spent its pixels in the wrong order. Anything longer than the cap is
 * still this pill's own problem — a state at `9.5rem` is a state that has
 * already told the reader what it is.
 *
 * **Green is about the PAGE, not about the socket.** It reads the framework's
 * `client.health()` alongside the transport status, because a socket that is
 * open and answering under a dead subscription is exactly the shape of lie this
 * component exists to prevent: a `documents.keys` stream that died renders as a
 * directory with no documents in it, and nothing anywhere said otherwise
 * (`document/documents.tsx` chose `rawStream` precisely so that stream would be
 * IN the health fact — and then nothing in olai read the fact). Folded in here
 * rather than drawn as a third readout beside it, for the reason the git pill
 * beside it is quiet when it is happy: one green claim per page, or neither is
 * scanned.
 */

import { createMemo } from "solid-js"

import { lookOf, readoutOf, type SurfaceConnectionStatus, unhealthy } from "./status.ts"
import { DOT, PILL } from "../readout.ts"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"

/** The room a page keeps at the bottom of its reading column: the phone's home
 *  indicator (the inset is real because the shell asks for `viewport-fit=cover`).
 *
 *  Exported because the room is reserved somewhere else — the main pane's
 *  padding (../App.tsx) — and the size being reserved for is a fact about the
 *  reading column rather than about any one control. It used to also clear the
 *  corner pills; those live in the header now, so this is the home bar alone. */
export const CLEARANCE = "pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"

export function Indicator(props: { readonly status: SurfaceConnectionStatus }) {
  /**
   * Which subscriptions have stopped delivering.
   *
   * Read inside the component because `client.health()` is a reactive accessor
   * and this is the tracking scope that draws from it — the framework's own
   * rule for reading the fact. MEMOIZED because it is not a cheap read and
   * this is not a cheap place to make it: `health()` walks every enrolled
   * subscription and allocates one record per sub, enrolment is per KEY (one
   * per open document, one per transcript row), and it re-folds on every
   * membership change — so a streaming turn re-runs it on every row appended.
   * Six JSX expressions below each compile to their own effect, which without
   * a memo is that walk six times over per update. The framework's own
   * consumers of this fact (`HostStatusPip`, `SurfaceGate`) memoize for the
   * same reason.
   *
   * The `equals` is what makes the healthy case free: nothing erroring is the
   * same empty list every time, so the memo stops there instead of handing
   * five effects a fresh array to re-run on.
   */
  const stopped = createMemo(() => unhealthy(olai.health()), [], {
    equals: (was, now) =>
      was.length === now.length && was.every((name, at) => name === now[at]),
  })
  const readout = createMemo(() => readoutOf(props.status, stopped()))
  const look = createMemo(() => lookOf(props.status, stopped()))
  return (
    <div
      // No position of its own: it is a READOUT and not a control — nothing
      // here is tappable — so all it needs is to be legible wherever the layout
      // decides to put it. The pill itself is `../readout.ts`'s, shared with
      // the Commit pill beside it: `min-w-0` + truncate is what lets the header
      // keep a single row when a label is long, and one copy of that geometry
      // is one place for it to be got right.
      class={`${PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
      data-testid={TESTID.connection}
      // The state as an attribute, so a test asserts on the STATE rather than
      // on a colour: which utility paints "live" is a styling decision and this
      // is a contract (see ../testids.ts). It is the READOUT's state and not
      // the transport's: `live` here has always meant "the files on disk reach
      // this page", and a socket that is up under a dead subscription does not.
      data-connection={readout()}
      // What stopped, for a test and for anybody reading the DOM. Absent when
      // nothing has.
      data-stopped={stopped().length > 0 ? stopped().join(" ") : undefined}
      title={look().detail}
      // Announced when it changes, never focus-stealing: a screen reader should
      // hear "disconnected" without losing its place in the outline.
      aria-live="polite"
    >
      <span class={`${DOT} ${look().dot}`} aria-hidden="true" />
      <span class="min-w-0 truncate">{look().label}</span>
    </div>
  )
}
