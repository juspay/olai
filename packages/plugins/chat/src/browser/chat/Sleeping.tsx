/**
 * THE OPT-IN AS A STRIP OF ITS OWN — whether olai tidies this chat's memory on
 * its own clock, under the conversation where a person looks for what it does
 * without being asked.
 *
 * ITS OWN COMPONENT, AND NOT A ROW INSIDE {@link ./Wake.tsx}, because the two are
 * different things wearing the same bar: that one is other plugins' faces hung
 * through
 * the `conversation.wake` slot, with chat persisting each face's per-session
 * pick, and this one is CHAT'S OWN, per NODE, already persisted as a vault
 * property (`chat-agent-sleep`). One is a doorbell somebody else rang; the other
 * is whether olai rings at all. Braiding them would make a plugin's wake and
 * chat's own mark one component that changes for two unrelated reasons — and the
 * pick store is not this mark's home: the vault is, and this keeps nothing but
 * the refusal a press may come back with.
 *
 * It is drawn in {@link ./Strips.tsx} beside the wake strip, in the same classes
 * and the same shape a plugin's own switch uses (a label, a rule, a
 * `role="switch"`, a refusal in a `role="alert"`), so the bar reads as one; the
 * wake strip keeps its own rule — no hung faces, no strip — exactly as it was.
 */

import { Result } from "effect"
import { createMemo, createSignal, Show } from "solid-js"
import { agentIn } from "../../wire.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { agentReadings } from "../agents/reading.ts"
import { chatWire } from "../wire.ts"
import { TESTID } from "../../testids.ts"
import type { Chat } from "./state.ts"
import { nodeAgentOf, sleepWords } from "./sleeping.ts"

export function Sleeping(props: { readonly chat: Chat }) {
  const to = createMemo(() => {
    const state = props.chat.state()
    const agent = agentIn(state)
    return agent && state.session ? { agent: agent.id, session: state.session.id } : undefined
  }, undefined, { equals: (before, after) => before?.agent === after?.agent && before?.session === after?.session })
  const row = createMemo(() => nodeAgentOf(agentReadings()?.agents.rows() ?? [], to()))
  const [problem, setProblem] = createSignal<string>()
  return <Show when={row()}>{(held) => {
    const on = () => held().sleeps
    return <section class="relative shrink-0 border-b border-rule/60 bg-panel px-3 py-1.5 text-caption leading-snug" data-testid={TESTID.chatSleeping} aria-label="Alerts">
      <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="text-muted">Sleep when idle</span><span aria-hidden="true" class="text-muted">·</span>
        <button type="button" role="switch" aria-label="Sleep when idle" aria-checked={on()} data-testid={TESTID.chatSleepSwitch} onClick={() => {
          setProblem(undefined)
          void runAsync(chatWire().procedures.conversation.setSleeping({ node: held().id, on: !on() })).then(outcome => {
            if (Result.isFailure(outcome)) setProblem(outcome.failure.message)
          })
        }}>{sleepWords(on())}</button>
        <Show when={problem()}><span role="alert">{problem()}</span></Show>
      </p>
    </section>
  }}</Show>
}
