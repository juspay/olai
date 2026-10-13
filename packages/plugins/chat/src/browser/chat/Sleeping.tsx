/**
 * THE OPT-IN AS AN ITEM ON THE STANDING LINE — whether olai tidies this chat’s
 * memory on its own clock, under the conversation where a person looks for what
 * it does without being asked.
 *
 * ITS OWN COMPONENT, AND NOT A FACE HUNG THROUGH THE WAKE SLOT
 * ({@link ./Wake.tsx}), because the two are different things wearing the same
 * line: that one is other plugins’ faces, with chat persisting each face’s
 * per-session pick, and this one is CHAT’S OWN, per NODE, already persisted as a
 * vault property (`chat-agent-sleep`). One is a doorbell somebody else rang; the
 * other is whether olai rings at all. Braiding them would make a plugin’s wake
 * and chat’s own mark one component that changes for two unrelated reasons — and
 * the pick store is not this mark’s home: the vault is, and this keeps nothing
 * but the refusal a press may come back with.
 *
 * IT IS AN ITEM, NOT A STRIP: the bar is drawn once ({@link ./Standing.tsx}) and
 * this is the first thing on it, in the same classes a plugin’s own switch uses
 * (a label, a rule, a `role="switch"`, a refusal in a `role="alert"`), so the
 * line reads as one. Its `aria-label` is its own — a screen reader told that the
 * sleep item is "Alerts" would be told that olai tidying a memory on a schedule
 * is an alarm, which it is the opposite of.
 */

import { Result } from "effect"
import { createMemo, createSignal, For, Show } from "solid-js"
import { runAsync } from "@olai/web/client/run.ts"
import { agentReadings } from "../agents/reading.ts"
import { chatWire } from "../wire.ts"
import { TESTID } from "../../testids.ts"
import { createNow } from "./elapsed.ts"
import type { Chat } from "./state.ts"
import { addressOf, nodeAgentOf, saidOf, sameAddress, sleepWords } from "./sleeping.ts"

export function Sleeping(props: { readonly chat: Chat }) {
  const to = createMemo(() => addressOf(props.chat.state()), undefined, { equals: sameAddress })
  const row = createMemo(() => nodeAgentOf(agentReadings()?.agents.rows() ?? [], to()))
  const [problem, setProblem] = createSignal<string>()
  // THE STRIP’S OWN CLOCK, at the resolution the phrases need ({@link ./elapsed.ts}),
  // and it runs only while this item is on screen — which is what `Standing`’s
  // own gate buys: a conversation with no node agent costs a tab nothing.
  const now = createNow(() => true)
  return <Show when={row()}>{(held) => {
    const said = () => saidOf(held().sleep, now())
    // ONE SOURCE FOR THE MARK, and it is the row's: `sleeps` is what the vault
    // says and what the verb writes, so the switch's state, its word and its press
    // all read it and nothing else. What `said` answers is the FORECAST — when this
    // chat slept and when it will next — and it is deliberately not asked whether
    // the mark is on.
    const on = () => held().sleeps
    return <span
      class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
      data-testid={TESTID.chatSleeping}
      role="group"
      aria-label="Sleep"
      // THE STATE AS DATA, for the same reason the wake picker’s is: the words
      // around it are a sentence, and a scenario asserting that would be
      // asserting the phrasing rather than the fact.
      data-next={said().kind}
      data-last={held().sleep?.lastSlept ?? undefined}
      // THE WHOLE SENTENCE, rhythm and all, where a person hovers.
      title={said().title}
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
        {/* NO SWITCH, because the answer is in a file this browser cannot write:
            `sleep` is off in the directory’s settings. */}
        <span class="text-muted">off in Settings</span>
      </Show>
      <For each={said().said}>{(part) => <>
        <span aria-hidden="true" class="text-muted">·</span>
        <span class="text-muted">{part}</span>
      </>}</For>
      {/* THE PASS, ASKED FOR BY HAND — the same verb the row menu and ⌘K carry,
          here for a person who is reading the strip and does not want to wait for
          the rhythm. NOT WHILE IT IS ALREADY RUNNING on this node (the words
          beside it say so, and a press could only be refused), and not where
          there is no pass to ask for at all. */}
      <Show when={said().switch && on() && said().kind !== "running"}>
        <span aria-hidden="true" class="text-muted">·</span>
        <button type="button" data-testid={TESTID.chatSleepNow} onClick={() => {
          setProblem(undefined)
          void runAsync(chatWire().procedures.conversation.sleepNow({ node: held().id })).then(outcome => {
            if (Result.isFailure(outcome)) { setProblem(outcome.failure.message); return }
            if (outcome.success._tag === "Refused") setProblem(outcome.success.said)
          })
        }}>Sleep now</button>
      </Show>
      <Show when={problem()}><span role="alert">{problem()}</span></Show>
    </span>
  }}</Show>
}
