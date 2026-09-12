/**
 * THE ODU READOUT — whether this olai can see the per-user service.
 *
 * Same three-state pill kolu's padi readout keeps. Desktop only, like the
 * pills it sits with.
 */

import { Show, type Accessor } from "solid-js"


import type { OduLink } from "olai-plugin-odu/appliance/wire"

import { TESTID } from "../testids.ts"
import { oduSaid } from "./said.ts"

/** The furniture this face spends of the app's bar — redeclared so this
 *  package does not import kolu. */
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
  const said = () => oduSaid(props.link())
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <span
        class={`${pill.PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
        data-testid={TESTID.odu}
        data-odu={props.link().status}
        title={said().detail}
        aria-label={`odu: ${said().detail}`}
      >
        <span class={`${pill.DOT} ${said().dot}`} aria-hidden="true" />
        <span class="min-w-0 truncate">{said().label}</span>
      </span>
    </Show>
  )
}
