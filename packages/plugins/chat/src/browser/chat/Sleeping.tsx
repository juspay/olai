import { Result } from "effect"
import { createMemo, createSignal, For, Show } from "solid-js"
import { runAsync } from "@olai/web/client/run.ts"
import { agentReadings } from "../agents/reading.ts"
import { chatWire } from "../wire.ts"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { createNow } from "./elapsed.ts"
import type { Chat } from "./state.ts"
import { addressOf, sameAddress } from "./address.ts"
import { nodeAgentOf, saidOf, sleepWords } from "./sleeping.ts"

export function Sleeping(props: { readonly chat: Chat }) {
  const to = createMemo(() => addressOf(props.chat.state()), undefined, { equals: sameAddress })
  const row = createMemo(() => nodeAgentOf(agentReadings()?.agents.rows() ?? [], to()))
  const [problem, setProblem] = createSignal<string>()
  return <Show when={row()}>{(held) => {
    const now = createNow(() => true)
    const said = () => saidOf(held().sleep, now())
    const on = () => held().sleeps
    return <Tip text={said().title} say>
    <span
      class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
      data-testid={TESTID.chatSleeping}
      role="group"
      aria-label="Sleep"
      data-next={said().kind}
      data-last={held().sleep?.lastSlept ?? undefined}
    >
      <span class="text-muted">Sleep</span>
      <span aria-hidden="true" class="text-muted">·</span>
      <Show when={!said().switch} fallback={
        <button type="button" role="switch" aria-label="Sleep when idle" aria-checked={on()} data-testid={TESTID.chatSleepSwitch} onClick={() => {
          setProblem(undefined)
          void runAsync(chatWire().procedures.conversation.setSleeping({ node: held().id, on: !on() })).then(outcome => {
            if (Result.isFailure(outcome)) setProblem(outcome.failure.message)
          })
        }}>{sleepWords(on())}</button>
      }>
        <span class="text-muted">off in Settings</span>
      </Show>
      <For each={said().said}>{(part) => <>
        <span aria-hidden="true" class="text-muted">·</span>
        <span class="text-muted">{part}</span>
      </>}</For>
      <Show when={said().switch && on() && said().kind !== "running"}>
        <span aria-hidden="true" class="text-muted">·</span>
        <button type="button" data-testid={TESTID.chatTidyMemory} onClick={() => {
          setProblem(undefined)
          void runAsync(chatWire().procedures.conversation.tidyMemory({ node: held().id })).then(outcome => {
            if (Result.isFailure(outcome)) { setProblem(outcome.failure.message); return }
            if (outcome.success._tag === "Refused") setProblem(outcome.success.said)
          })
        }}>Tidy memory</button>
      </Show>
      <Show when={problem()}><span role="alert">{problem()}</span></Show>
    </span>
    </Tip>
  }}</Show>
}
