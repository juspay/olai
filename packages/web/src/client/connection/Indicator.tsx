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
 */

import { LOOK, type SurfaceConnectionStatus } from "./status.ts"
import { DOT, PILL } from "../readout.ts"
import { TESTID } from "../testids.ts"

/** The room a page keeps at the bottom of its reading column: the phone's home
 *  indicator (the inset is real because the shell asks for `viewport-fit=cover`).
 *
 *  Exported because the room is reserved somewhere else — the main pane's
 *  padding (../App.tsx) — and the size being reserved for is a fact about the
 *  reading column rather than about any one control. It used to also clear the
 *  corner pills; those live in the header now, so this is the home bar alone. */
export const CLEARANCE = "pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"

export function Indicator(props: { readonly status: SurfaceConnectionStatus }) {
  const look = () => LOOK[props.status]
  return (
    <div
      // No position of its own: it is a READOUT and not a control — nothing
      // here is tappable — so all it needs is to be legible wherever the layout
      // decides to put it. The pill itself is `../readout.ts`'s, shared with
      // the git readout beside it: `min-w-0` + truncate is what lets the header
      // keep a single row when a label is long, and one copy of that geometry
      // is one place for it to be got right.
      class={`${PILL} max-w-[9.5rem] sm:max-w-none`}
      data-testid={TESTID.connection}
      // The state as an attribute, so a test asserts on the STATE rather than
      // on a colour: which utility paints "live" is a styling decision and this
      // is a contract (see ../testids.ts).
      data-connection={props.status}
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
