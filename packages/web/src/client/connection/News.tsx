/**
 * Connection as a phone banner — only `degraded`, because that is the one
 * state that is news while the page is still usable.
 *
 * `connecting` / `reconnecting` / `retired` already take the app away
 * (`./Offline.tsx`). `live` is health, and a healthy phone does not
 * advertise it. WHERE this sits is `../News.tsx`.
 */

import { Show } from "solid-js"

import { isDegraded, lookOf, type SurfaceReadout } from "./status.ts"
import { BANNER } from "../readout.ts"
import { TESTID } from "../testids.ts"

export function ConnectionNews(props: { readonly readout: SurfaceReadout }) {
  const look = () => lookOf(props.readout)
  return (
    <Show when={isDegraded(props.readout)}>
      <div
        class={`${BANNER} text-doing`}
        data-testid={TESTID.connection}
        data-connection={props.readout.status}
        data-stopped={props.readout.stopped?.join(" ")}
        title={look().detail}
        aria-live="polite"
      >
        {look().label} — {look().detail}
      </div>
    </Show>
  )
}
