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
 * The one thing it moves for is the agent panel, which is a drawer along the
 * same edge. Stepping aside rather than being covered: a dot that is sometimes
 * behind a panel is a dot a reader cannot rely on, and "always on screen" is
 * the whole of what this promises.
 */

import { chatOpen } from "../chat/open.ts"
import { LOOK, type SurfaceConnectionStatus } from "./status.ts"
import { TESTID } from "../testids.ts"

/** Clear of the drawer: its own width, plus the gap the dot keeps from every
 *  edge. Both halves come from the same token (`--width-chat`, styles.css), so
 *  the two cannot drift apart — which they would, being in different files. */
const CLEAR_OF_PANEL = "right-[calc(var(--width-chat)+0.75rem)]"

export function Indicator(props: { readonly status: SurfaceConnectionStatus }) {
  const look = () => LOOK[props.status]
  return (
    <div
      class={`fixed bottom-3 z-40 flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-xs text-muted ${
        chatOpen() ? CLEAR_OF_PANEL : "right-3"
      }`}
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
