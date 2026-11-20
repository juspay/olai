import { createMemo } from "solid-js"

import { Show, type Accessor } from "solid-js"

import { TESTID } from "../testids.ts"
import type { Account } from "../wire.ts"
import { mailSaid } from "./said.ts"
import { TONE } from "olai-plugin-layout/slots"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LAYER } from "@olai/web/client/layer.ts"

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
  const said = createMemo(() => mailSaid(props.account()))
  const detail = () => said().detail
  const pill = props.app.pill
  return (
    <Show when={props.app.desktop()}>
      <Tip text={detail() ?? ""} layer={LAYER.over} disabled={detail() === undefined}>
        <span
          class={`${pill.PILL} max-w-[9.5rem] shrink-0 sm:max-w-none`}
          data-testid={TESTID.mail}
          data-mail={props.account().status}
          data-address={props.account().address ?? undefined}
        >
          <span class={`${pill.DOT} ${TONE[said().tone].dot}`} data-health={said().tone} aria-hidden="true" />
          <span class="min-w-0 truncate">{said().label}</span>
        </span>
        <Show when={detail()}>{(told) => <span class="sr-only">{`mail: ${told()}`}</span>}</Show>
      </Tip>
    </Show>
  )
}
