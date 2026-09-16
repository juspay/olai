/** The strip owns rows and queue counts; each hung face owns its control. */
import { Effect, Schema } from "effect"
import { createMemo, For, Show } from "solid-js"
import { agentIn } from "olai-plugin-chat/wire"
import { faces } from "../faces.ts"
import { olai } from "@olai/web/client/wire.ts"
import { TESTID } from "../../testids.ts"
import type { Chat } from "./state.ts"

export function Wake(props: { readonly chat: Chat }) {
  const roster = olai.cells.plugins.use()
  const to = createMemo(() => {
    const state = props.chat.state()
    const agent = agentIn(state)
    return agent && state.session ? { agent: agent.id, session: state.session.id } : undefined
  }, undefined, { equals: (before, after) => before?.agent === after?.agent && before?.session === after?.session })
  const rows = () => faces().hung("conversation.wake")
  return <Show when={to()} keyed>{conversation =>
    <Show when={rows().length > 0}>
      <section class="relative shrink-0 border-b border-rule/70 bg-panel px-3 py-1.5 font-mono text-[0.6875rem] leading-snug" data-testid={TESTID.chatWake} aria-label="wakes on">
        <For each={rows()}>{row => {
          const mine = () => props.chat.state().wake.find(one => one.name === row.plugin)
          const waiting = () => mine()?.waiting ?? 0
          const words = () => roster.value()?.built.find(one => one.name === row.plugin)?.wake
          return <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {row.face({ conversation, pick: () => mine()?.pick ?? null, waiting,
              setPick: next => Schema.is(Schema.Json)(next)
                ? props.chat.scope(conversation.agent, conversation.session, row.plugin, next)
                : Effect.fail({ reason: "a wake pick must be JSON" }),
            })}
            <Show when={waiting() > 0 && words()}><span class="shrink-0 text-doing" data-testid={TESTID.chatWakeWaiting} data-waiting={waiting()}>{waiting()} {waiting() === 1 ? words()?.waiting.one : words()?.waiting.many}</span></Show>
          </p>
        }}</For>
      </section>
    </Show>
  }</Show>
}
