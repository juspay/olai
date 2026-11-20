import { TESTID } from "olai-plugin-layout/testids"
import { Show } from "solid-js"

import { LAYER } from "@olai/web/client/layer.ts"
import { startedAt } from "./named.ts"
import { PILL } from "@olai/web/client/readout.ts"

import { Tip } from "@olai/web/client/Tip.tsx"
import { createNow, sinceOf, upOf } from "@olai/web/client/uptime.ts"

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
    <span data-testid={TESTID.uptime} data-started={startedAt()} class="contents">
      <Show when={says() !== ""}>
        <Tip text={said()} layer={LAYER.over}>
          <div class={`${PILL} !pl-6 text-label !text-muted`}>
            {says()}
            <span class="sr-only">{said()}</span>
          </div>
        </Tip>
      </Show>
    </span>
  )
}
