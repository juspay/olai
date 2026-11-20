import { Show } from "solid-js"

import { Thumb } from "olai-plugin-layout/thumb"

import { TESTID } from "../../testids.ts"
import { useAgents } from "./answered.tsx"
import { needing } from "./attention-order.ts"
import { agentReadings } from "./reading.ts"

export function ChatsThumb(props: { readonly reveal: () => void }) {
  const agents = useAgents()
  const waiting = () => needing(agents.rows()).length
  return (
    <Thumb
      label="Chats"
      testid={TESTID.thumbChats}
      data={{ "data-waiting": String(waiting()) }}
      badge={<Show when={waiting() > 0}>{waiting()}</Show>}
      onClick={() => {
        props.reveal()
        requestAnimationFrame(() => agentReadings()?.focusNeeds())
      }}
    >
      <svg viewBox="0 0 16 16" class="size-5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
      </svg>
    </Thumb>
  )
}
