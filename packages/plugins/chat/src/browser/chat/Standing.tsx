import { Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { agentReadings } from "../agents/reading.ts"
import { faces } from "../faces.ts"
import { addressOf } from "./address.ts"
import { nodeAgentOf } from "./sleeping.ts"
import type { Chat } from "./state.ts"
import { Sleeping } from "./Sleeping.tsx"
import { Wake } from "./Wake.tsx"

export function Standing(props: { readonly chat: Chat }) {
  const to = () => addressOf(props.chat.state())
  const sleeping = () => nodeAgentOf(agentReadings()?.agents.rows() ?? [], to()) !== undefined
  const waking = () => to() !== undefined && faces().hung("conversation.wake").length > 0
  return (
    <Show when={sleeping() || waking()}>
      <section
        class="relative shrink-0 border-b border-rule bg-desk/40 px-3 py-1.5 text-caption leading-snug"
        data-testid={TESTID.chatStanding}
        aria-label="Standing"
      >
        <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Sleeping chat={props.chat} />
          <Show when={sleeping() && waking()}>
            <span aria-hidden="true" class="text-muted">·</span>
          </Show>
          <Wake chat={props.chat} />
        </p>
      </section>
    </Show>
  )
}
