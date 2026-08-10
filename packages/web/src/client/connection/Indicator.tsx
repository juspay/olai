/**
 * The dot in the corner: is this page still talking to a server?
 *
 * It is small, it is always there, and it is the only thing on screen that
 * reports on the connection rather than on the outlines. Always THERE is the
 * point — an indicator that only appears when something is wrong cannot be
 * trusted when it is absent, because "healthy" and "not rendered" look the
 * same. Green is a claim this page keeps making.
 *
 * Fixed to the viewport rather than placed in the sidebar, because the sidebar
 * is not always drawn: a set that never loaded replaces the whole layout with
 * its error report, and that is a page whose connection a reader wants to know
 * about most of all.
 */

import { LOOK, type SurfaceConnectionStatus } from "./status.ts"
import { TESTID } from "../testids.ts"

export function Indicator(props: { readonly status: SurfaceConnectionStatus }) {
  const look = () => LOOK[props.status]
  return (
    <div
      // Fixed to the bottom right, and lifted by whatever is in the way there.
      // `--visible-bottom` is how much of the page a phone is covering with an
      // on-screen keyboard (../viewport.ts) and the safe-area inset is the home
      // bar; both are zero on a laptop, so the offset is the plain 0.75rem
      // there. It is a READOUT and not a control — nothing here is tappable —
      // so it needs no target size, only to stay visible.
      class="fixed right-3 bottom-[calc(0.75rem+var(--visible-bottom,0px)+env(safe-area-inset-bottom,0px))] z-40 flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs text-muted"
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
