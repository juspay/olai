/**
 * WHAT A CONVERSATION HAS STANDING, ON ONE LINE — whether olai tidies this
 * chat’s memory on its own clock, and what may ring it.
 *
 * ONE LINE, AND NOT ONE STRIP EACH, because these are per-conversation standing
 * facts of the same kind: a person reads them together or not at all, and the
 * head was spending a bordered strip on each — three strips of chrome above a
 * transcript to say two short things. They belong on one line that wraps on a
 * phone, in the same 11px mono the strip above them uses, with the sleep item
 * first because it is the answer the wake items hang off: whether this chat is
 * tidied at all is what decides whether a wake can be acted on.
 *
 * THE ITEMS STAY SEPARATE COMPONENTS ({@link ./Sleeping.tsx}, {@link ./Wake.tsx})
 * and that is the point of drawing the bar here: they change for unrelated
 * reasons — one is chat’s own mark on a node, the other is other plugins’ faces
 * with their own picks — and one line is the only thing they share.
 *
 * IT ASKS TWO PRESENCE QUESTIONS OF ITS OWN, and they are not a second opinion
 * about what the items say: the bar has to be ABSENT when there is nothing to put
 * on it (a plain chat, or a node agent with no hung faces, would otherwise wear a
 * bordered empty line), and whether a rule belongs between the two kinds depends
 * on whether both drew. What each item SAYS is still its own — the questions here
 * are "is there a sleep item" and "is there a wake face", read off the same two
 * sources the items read.
 */

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
        class="relative shrink-0 border-b border-rule/60 bg-panel px-3 py-1.5 text-caption leading-snug"
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
