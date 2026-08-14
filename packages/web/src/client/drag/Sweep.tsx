/**
 * The band a drag-across pulls, drawn.
 *
 * A BAND and not a rubber-band box, because that is what the gesture actually
 * asks (`./sweep.ts` has the argument): a row is a line, so the sweep reads Y
 * and spans the rows' own width. Drawing a rectangle that followed the pointer
 * sideways would promise a second axis the answer does not have — a person
 * would pull the corner in and expect the deep rows to drop out of the pick,
 * and they would not.
 *
 * Positioned ABSOLUTELY out of a portal, in document coordinates, exactly as
 * the drop line beside it is (`./DropLine.tsx`): with no positioned ancestor an
 * absolute box lies against the initial containing block, which scrolls with
 * the page — so the band stays over the rows it names while the gesture
 * auto-scrolls, and nothing here listens for that.
 *
 * `LAYER.row`, the same claim the drop line and the `•••` panel make: over the
 * rows, under every piece of chrome. It is a WASH rather than a fill — the rows
 * it crosses are already wearing the pick's own accent, and a band opaque
 * enough to hide that would be the gesture covering its own answer.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import { LAYER } from "../layer.ts"
import { TESTID } from "../testids.ts"
import type { Sweep } from "./sweep.ts"

export function SweepBand(props: { readonly sweep: Sweep | null }) {
  return (
    <Show when={props.sweep}>
      {(sweep) => (
        <Portal>
          <div
            class={`pointer-events-none absolute ${LAYER.row} rounded-sm border border-accent/40 bg-accent/5`}
            style={{
              top: `${sweep().top}px`,
              left: `${sweep().left}px`,
              width: `${sweep().width}px`,
              // No clamp: `top` is the lesser of the pull's two ends and
              // `bottom` the greater, so this cannot be negative.
              height: `${sweep().bottom - sweep().top}px`,
            }}
            data-testid={TESTID.sweepBand}
            // How many rows it is crossing right now — the one fact about a
            // sweep that is still a prediction while the pointer is down, said
            // as data rather than left to be counted off the toned rows.
            data-rows={String(sweep().run?.keys.length ?? 0)}
            aria-hidden="true"
          />
        </Portal>
      )}
    </Show>
  )
}
