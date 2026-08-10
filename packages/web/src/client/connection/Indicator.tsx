/**
 * The dot in the corner: is this page still talking to a server?
 *
 * It is small, it is always there, and it is the only thing on screen that
 * reports on the connection rather than on the outlines. Always THERE is the
 * point — an indicator that only appears when something is wrong cannot be
 * trusted when it is absent, because "healthy" and "not rendered" look the
 * same. Green is a claim this page keeps making.
 *
 * WHERE it goes is the layout's to say, not this component's, and there are two
 * answers because there are two layouts: the sidebar's footer, beside the agent
 * toggle, on every page that draws a sidebar — and a corner of the viewport on
 * the ones that do not, which are the error report and the waiting page, and
 * are exactly the pages whose connection a reader wants to know about most of
 * all. Fixed is the fallback rather than the rule: a pill fixed to the corner
 * of a page with an outline on it sits on the last line of whatever scrolls
 * under it, and it used to.
 */

import { LOOK, type SurfaceConnectionStatus } from "./status.ts"
import { TESTID } from "../testids.ts"

/** The room a page keeps at the bottom of its reading column: the phone's home
 *  indicator (the inset is real because the shell asks for `viewport-fit=cover`)
 *  plus the height of one of these pills, for the pages that draw the pair in
 *  the corner rather than in a sidebar.
 *
 *  Exported because the room is reserved somewhere else — the main pane's
 *  padding (../App.tsx) — and the size being reserved for is a fact about this
 *  component: its type, its padding and its offset. A number chosen over there
 *  would go on being 4rem after this grew a second line. */
export const CLEARANCE = "pb-[calc(4rem+env(safe-area-inset-bottom,0px))]"

/** Where the corner pair sits when there is no sidebar to hold it, lifted by
 *  whatever is in the way down there. `--visible-bottom` is how much of the
 *  page a phone is covering with an on-screen keyboard (../viewport.ts) and the
 *  safe-area inset is the home bar; both are zero on a laptop, so the offset is
 *  the plain 0.75rem there. */
export const CORNER =
  "fixed left-3 bottom-[calc(0.75rem+var(--visible-bottom,0px)+env(safe-area-inset-bottom,0px))] z-40"

export function Indicator(props: { readonly status: SurfaceConnectionStatus }) {
  const look = () => LOOK[props.status]
  return (
    <div
      // No position of its own: it is a READOUT and not a control — nothing
      // here is tappable — so all it needs is to be legible wherever the layout
      // decides to put it.
      class="flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs text-muted"
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
      <span class={`inline-block size-2 rounded-full ${look().dot}`} aria-hidden="true" />
      {look().label}
    </div>
  )
}
