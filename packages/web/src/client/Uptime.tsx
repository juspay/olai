/**
 * The quiet chip that says how long the olai server has been up.
 *
 * Furniture, not an alarm: `up 2h`, the committed-pill cluster's voice, in
 * the same `PILL` those chips wear. The value is the SERVER's process start,
 * crossed once on `app.get` (`./named.ts`); `./uptime.ts` ticks it locally
 * from that landing. A restart retires the tab; the page that reloads is a
 * new ask, which is why it can read `up 12s`.
 *
 * DESKTOP ONLY, like the pills it sits with: a healthy phone does not
 * advertise health. The chip is not a control. The exact start instant
 * is in a visually-hidden span (and on the tip, for a pointer) so it
 * is not hover-only.
 */

import { Show } from "solid-js"

import { LAYER } from "./layer.ts"
import { startedAt } from "./named.ts"
import { PILL } from "./readout.ts"
import { TESTID } from "./testids.ts"
import { Tip } from "./Tip.tsx"
import { createNow, sinceOf, upOf } from "./uptime.ts"

export function Uptime() {
  const now = createNow(startedAt)
  const says = () => {
    const at = startedAt()
    return at === undefined ? "" : upOf(at, now())
  }
  const said = () => {
    const at = startedAt()
    return at === undefined ? "" : sinceOf(at)
  }
  return (
    // The TESTID is always in the desktop cluster, even before `app.get`
    // has answered: a chip that mounts a frame later is a missing testid
    // in the row. The PILL itself waits — an empty oval is not furniture.
    <span data-testid={TESTID.uptime} data-started={startedAt()} class="contents">
      <Show when={says() !== ""}>
        <Tip text={said()} layer={LAYER.over}>
          <div class={`${PILL} shrink-0`}>
            {says()}
            <span class="sr-only">{said()}</span>
          </div>
        </Tip>
      </Show>
    </span>
  )
}
