/** The browser's row in the bar's health popover: where it stands, and a
 *  link to the pane. */
import { TONE } from "olai-plugin-layout/slots"
import type { Accessor } from "solid-js"
import { TESTID } from "../testids.ts"
import type { Standing } from "../wire.ts"
import { lookOf } from "./said.ts"

export interface BrowserBar {
  readonly pill: { readonly PILL: string; readonly DOT: string }
}

export function BrowserHeader(props: { readonly app: BrowserBar; readonly standing: Accessor<Standing>; readonly href: string }) {
  const look = () => lookOf(props.standing())
  return (
    <a href={props.href} class={`${props.app.pill.PILL} shrink-0`} data-testid={TESTID.browserHeader}
      data-standing={props.standing().kind} title={look().detail} aria-label={`Browser: ${look().detail}`}>
      <span class={`${props.app.pill.DOT} ${TONE[look().tone].dot}`} data-health={look().tone} aria-hidden="true" />
      <span class="min-w-0 truncate">{look().label}</span>
    </a>
  )
}
