import { createMemo } from "solid-js"

import { Show, type Accessor } from "solid-js"


import type { OduLink } from "olai-plugin-odu/appliance/wire"

import { TESTID } from "../testids.ts"
import { oduSaid } from "./said.ts"
import { TONE } from "olai-plugin-layout/slots"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

export interface OduBar {
  readonly desktop: () => boolean
  readonly pill: {
    readonly PILL: string
    readonly DOT: string
  }
}

export function OduReadout(props: {
  readonly app: OduBar
  readonly link: Accessor<OduLink>
}) {
  const said = createMemo(() => oduSaid(props.link()))
  const detail = () => said().detail
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <Tip text={detail() ?? ""} layer={LAYER.over} disabled={detail() === undefined}>
        <span
          class={`${pill.PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
          data-testid={TESTID.odu}
          data-odu={props.link().status}
        >
          <span class={`${pill.DOT} ${TONE[said().tone].dot}`} data-health={said().tone} aria-hidden="true" />
          <span class="min-w-0 truncate">{said().label}</span>
        </span>
        <Show when={detail()}>{(told) => <span class="sr-only">{`odu: ${told()}`}</span>}</Show>
      </Tip>
    </Show>
  )
}
