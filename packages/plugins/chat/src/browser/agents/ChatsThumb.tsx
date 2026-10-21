/**
 * THE CHATS THUMB — the phone's one-tap door to the conversations
 * (`olai-plugin-layout`'s `layout.thumbs`).
 *
 * A phone has no seat for the dock, so its conversations are reached through
 * the drawer's Chats and Needs you sections. This thumb opens that drawer and
 * puts the caret on Needs you, so an agent waiting on a person is one tap and
 * a glance away rather than a burger, a scroll and a search. The badge is the
 * count of conversations that need somebody — the same rows the Needs you
 * section lists — and nothing else: a count of every chat would be a number
 * nobody acts on.
 */
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
        // The drawer is drawn on the next frame; the caret follows it there.
        requestAnimationFrame(() => agentReadings()?.focusNeeds())
      }}
    >
      <svg viewBox="0 0 16 16" class="size-5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
      </svg>
    </Thumb>
  )
}
