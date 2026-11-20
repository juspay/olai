import { createMemo } from "solid-js"

import { Show } from "solid-js"

import { TESTID } from "../testids.ts"

import type { SpacesApp } from "./app.ts"
import { useLink } from "./link.tsx"
import { spacesSaid } from "./said.ts"
import { TONE } from "olai-plugin-layout/slots"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

export function Spaces(props: { readonly app: SpacesApp }) {
  const link = useLink()
  const said = createMemo(() => spacesSaid(link()))
  const detail = () => said().detail
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <Tip text={detail() ?? ""} layer={LAYER.over} disabled={detail() === undefined}>
        <span
          class={`${pill.PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
          data-testid={TESTID.spaces}
          data-spaces={link().status}
        >
          <span class={`${pill.DOT} ${TONE[said().tone].dot}`} data-health={said().tone} aria-hidden="true" />
          <span class={`min-w-0 truncate ${TONE[said().tone].text}`}>
            {said().label}
          </span>
        </span>
        <Show when={detail()}>{(told) => <span class="sr-only">{`xyne: ${told()}`}</span>}</Show>
      </Tip>
    </Show>
  )
}
