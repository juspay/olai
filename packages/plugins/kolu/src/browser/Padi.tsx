import { createMemo } from "solid-js"

import { Show } from "solid-js"

import { TONE } from "olai-plugin-layout/slots"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

import { padiSaid, useFleet } from "../appliance/index.ts"

import { TESTID } from "../testids.ts"
import type { KoluApp } from "./app.ts"
import { Feed } from "./Feed.tsx"

export function Padi(props: { readonly app: KoluApp }) {
  const fleet = useFleet()
  const said = createMemo(() => padiSaid(fleet.link(), fleet.pulse(), fleet.now()))
  const quiet = () => said().beat?.kind === "quiet"
  const popover = props.app.popover()
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <Tip text={said().detail} layer={LAYER.over}>
        <button
          type="button"
          ref={popover.setTrigger}
          class={`${pill.PILL} max-w-[9.5rem] shrink-0 cursor-pointer sm:max-w-none`}
          data-testid={TESTID.padi}
          data-padi={fleet.link().status}
          data-padibeat={said().beat?.kind ?? "none"}
          aria-label={`kolu: ${said().detail}`}
          aria-expanded={popover.open()}
          aria-haspopup="true"
          onClick={() => popover.toggle()}
        >
          <span class={`${pill.DOT} ${TONE[said().tone].dot}`} data-health={said().tone} aria-hidden="true" />
          <span class="min-w-0 truncate">{said().label}</span>
          <Show when={quiet() ? said().beat?.said : null}>
            {(beat) => <span class={`shrink-0 ${TONE[said().tone].text}`}>· {beat()}</span>}
          </Show>
        </button>
      </Tip>
      <popover.Panel
        testid={TESTID.padiFeed}
        label="Recent activity"
      >
        <Feed onLeave={popover.close} />
      </popover.Panel>
    </Show>
  )
}
