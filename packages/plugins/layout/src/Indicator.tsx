import { TESTID } from "olai-plugin-layout/testids"
import { Show } from "solid-js"

import { isDegraded, lookOf, type SurfaceReadout } from "@olai/web/client/connection/status.ts"
import { desktop } from "./layout/live.ts"
import { BANNER, DOT, PILL, TONE } from "@olai/web/client/readout.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LAYER } from "@olai/web/client/layer.ts"



export function Indicator(props: { readonly readout: SurfaceReadout }) {
  const look = () => lookOf(props.readout)
  return (
    <>
      <Show when={desktop()}>
        <Tip text={look().detail} layer={LAYER.over}>
          <div
            class={`${PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
            data-testid={TESTID.connection}
            data-connection={props.readout.status}
            data-stopped={props.readout.stopped?.join(" ")}
            aria-live="polite"
          >
            <span class={`${DOT} ${TONE[look().tone].dot}`} data-health={look().tone} aria-hidden="true" />
            <span class="min-w-0 truncate">{look().label}</span>
            <span class="sr-only">{look().detail}</span>
          </div>
        </Tip>
      </Show>
      <Show when={!desktop() && isDegraded(props.readout)}>
        <div
          class={`${BANNER} ${TONE[look().tone].text}`}
          data-testid={TESTID.connection}
          data-connection={props.readout.status}
          data-stopped={props.readout.stopped?.join(" ")}
          aria-live="polite"
        >
          {look().label} — {look().detail}
        </div>
      </Show>
    </>
  )
}
