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
 *
 * WHERE it goes is the layout's to say, not this component's: it sits in the
 * sidebar's footer, and in a corner of the viewport only on the screens that
 * have no sidebar — which is what keeps "always there" true without the pill
 * being fixed on top of somebody's paragraph on every page. It used to be
 * fixed at the bottom right and dodge the agent drawer by its width; dodging
 * kept it visible and still left it over the last line of everything that
 * scrolled past.
 */

import { LOOK, type SurfaceConnectionStatus } from "./status.ts"
import { TESTID } from "../testids.ts"

export function Indicator(props: { readonly status: SurfaceConnectionStatus }) {
  const look = () => LOOK[props.status]
  return (
    <div
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
