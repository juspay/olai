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

export function Spaces(props: { readonly app: SpacesApp }) {
  const link = useLink()
  const said = () => spacesSaid(link())
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <span
        class={`${pill.PILL} max-w-[9.5rem] shrink-0 sm:max-w-none ${
          said().loud ? pill.PILL_ALARM_COAT : ""
        }`}
        data-testid={TESTID.spaces}
        data-spaces={link().status}
        title={said().detail}
        aria-label={`spaces: ${said().detail}`}
      >
        <span
          class={`${pill.DOT} ${said().loud ? pill.DOT_HOLLOW_ALARM : ""}`}
          aria-hidden="true"
        />
        <span class={`min-w-0 truncate ${said().loud ? pill.TEXT_ALARM : ""}`}>
          {said().label}
        </span>
      </span>
    </Show>
  )
}
