/**
 * THE MAIL READOUT — whether this serve holds a Gmail account, and who for.
 *
 * Desktop only, like the pills it sits with, and shaped like
 * `olai-plugin-odu`'s own: a dot, a label, and the whole sentence in the title
 * so the reason is reachable without the panel.
 *
 * The address is on the element as `data-address` as well as in the label: a
 * scenario asserts WHICH mailbox a serve is reading without matching a sentence
 * a designer may reword (`../testids.ts`).
 */

import { Show, type Accessor } from "solid-js"

import { TESTID } from "../testids.ts"
import type { Account } from "../wire.ts"
import { mailSaid } from "./said.ts"

/** The furniture this face spends of the app's bar — redeclared so this package
 *  does not import layout's, exactly as odu's readout does. */
export interface MailBar {
  readonly desktop: () => boolean
  readonly pill: {
    readonly PILL: string
    readonly DOT: string
  }
}

export function MailReadout(props: {
  readonly app: MailBar
  readonly account: Accessor<Account>
}) {
  const said = () => mailSaid(props.account())
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <span
        class={`${pill.PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
        data-testid={TESTID.mail}
        data-mail={props.account().status}
        data-address={props.account().address ?? undefined}
        title={said().detail}
        aria-label={`mail: ${said().detail}`}
      >
        <span class={`${pill.DOT} ${said().dot}`} aria-hidden="true" />
        <span class="min-w-0 truncate">{said().label}</span>
      </span>
    </Show>
  )
}
