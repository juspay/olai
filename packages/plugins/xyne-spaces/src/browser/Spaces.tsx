import { createMemo } from "solid-js"
/**
 * THE SPACES READOUT — whether this olai can post to a bound channel.
 *
 * Three states rather than a boolean, like the padi pill: connected, absent,
 * fault. Desktop only, by the app's own breakpoint. Not a door — there is
 * no feed to open — so it is a `<span>` rather than a `<button>`.
 */

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
      {/* A READOUT, not a control: the sentence rides a hidden twin after the
          pill, because an `aria-label` on a bare span names nothing a screen
          reader will read. The tip draws the same words for a pointer, over
          the bar the pill sits in. */}
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
