import { Show } from "solid-js"

import { Tip } from "@olai/web/client/Tip.tsx"

import type { AuthStatus } from "@kolu/acp/wire"

import { TESTID } from "../../testids.ts"
import { identityOf, identityTitleOf } from "../chat/identityChip.ts"
import type { Chat } from "../chat/state.ts"

const CHIP = "inline-flex items-center rounded-control bg-ink/5 px-1.5 text-label text-muted"

export function Identity(props: {
  readonly chat: Chat
  readonly identity: () => AuthStatus
  readonly pressable: boolean
}) {
  const said = () => identityOf(props.identity())
  const title = () => identityTitleOf(props.identity())
  const kind = () => props.identity().kind ?? "unknown"
  return (
    <Show
      when={props.pressable}
      fallback={
        <Tip text={title()} say>
          <span
            class={CHIP}
            data-testid={TESTID.chatIdentity}
            data-kind={kind()}
            data-pressable="false"
          >
            {said()}
          </span>
        </Tip>
      }
    >
      <Tip text={`${title()} — press to sign in as someone else`}>
        <button
          type="button"
          class={`${CHIP} hover:bg-ink/10 hover:text-ink`}
          data-testid={TESTID.chatIdentity}
          data-kind={kind()}
          data-pressable="true"
          onClick={() => props.chat.signIn(null)}
        >
          {said()}
        </button>
        <span class="sr-only">{title()}</span>
      </Tip>
    </Show>
  )
}
