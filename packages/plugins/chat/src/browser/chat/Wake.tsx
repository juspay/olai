/** The strip owns rows and queue counts; each hung face owns its control. */
import { Effect, Result, Schema } from "effect"
import { createMemo, createSignal, For, Show } from "solid-js"
import { agentIn, type NodeAgentRow } from "olai-plugin-chat/wire"
import { faces } from "../faces.ts"
import { olai } from "@olai/web/client/wire.ts"
import { runAsync } from "@olai/web/client/run.ts"
import { chatWire } from "../wire.ts"
import { TESTID } from "../../testids.ts"
import type { Chat } from "./state.ts"

/** WHICH ROW OF THE AGENTS ROSTER THIS CONVERSATION IS, or `undefined` — the
 *  node agent whose engine and conversation are the ones on screen.
 *
 *  A PLAIN CHAT HAS NO SUCH ROW, and that is the whole gate: a conversation
 *  nobody is seated on has no node to mark, so it gets no switch. Read off the
 *  roster the browser already holds, never by walking the vault from here
 *  (`AgentPalette.ts` asks the same question of the same rows).
 *
 *  A FUNCTION AND NOT A MEMO, so the answer can be asserted without a
 *  reactive scope — `bun test` resolves SolidJS's server build, where a memo
 *  never re-runs (`justfile` says so where the browser tests are counted). */
export const nodeAgentOf = (
  rows: ReadonlyArray<NodeAgentRow>,
  to: { readonly agent: string; readonly session: string } | undefined,
): NodeAgentRow | undefined =>
  to === undefined
    ? undefined
    : rows.find((row) => row.engine === to.agent && row.session === to.session)

/**
 * THE OPT-IN, IN THE STRIP — chat's own row, drawn FIRST because it is the
 * answer the others depend on: whether this chat is tidied at all, and therefore
 * whether a doorbell waking it can ever be acted on.
 *
 * THE SAME SHAPE AS THE MAIL PLUGIN'S SWITCH: the label, a rule, a
 * `role="switch"` whose text is the state, and a refusal beside it in a
 * `role="alert"` rather than a row that vanishes. Pressing it is
 * `conversation.setSleeping`, the same door the row menu and the palette press;
 * the label a person reads is the mark itself (`sleeps` on the row).
 */
/** THE SWITCH'S WORDS, one function so the mapping can be asserted without a
 *  reactive scope: `aria-checked` is the mark itself and this is what a person
 *  reads beside it. */
export const sleepWords = (sleeps: boolean): "On" | "Off" => sleeps ? "On" : "Off"

function SleepRow(props: { readonly row: NodeAgentRow }) {
  const [problem, setProblem] = createSignal<string>()
  const on = () => props.row.sleeps
  return <><span class="text-muted">Sleep when idle</span><span aria-hidden="true" class="text-muted">·</span>
    <button type="button" role="switch" aria-label="Sleep when idle" aria-checked={on()} data-testid={TESTID.chatSleepSwitch} onClick={() => {
      setProblem(undefined)
      void runAsync(chatWire().procedures.conversation.setSleeping({ node: props.row.id, on: !on() })).then(outcome => {
        if (Result.isFailure(outcome)) setProblem(outcome.failure.message)
      })
    }}>{sleepWords(on())}</button>
    <Show when={problem()}><span role="alert">{problem()}</span></Show>
  </>
}

export function Wake(props: { readonly chat: Chat }) {
  const roster = olai.cells.plugins.use()
  const to = createMemo(() => {
    const state = props.chat.state()
    const agent = agentIn(state)
    return agent && state.session ? { agent: agent.id, session: state.session.id } : undefined
  }, undefined, { equals: (before, after) => before?.agent === after?.agent && before?.session === after?.session })
  const rows = () => faces().hung("conversation.wake")
  const agents = chatWire().cells.agents.use()
  const nodeAgent = createMemo(() => nodeAgentOf(agents.value() ?? [], to()))
  return <Show when={to()} keyed>{conversation =>
    <Show when={nodeAgent() !== undefined || rows().length > 0}>
      <section class="relative shrink-0 border-b border-rule/60 bg-panel px-3 py-1.5 text-caption leading-snug" data-testid={TESTID.chatWake} aria-label="Alerts">
        <Show when={nodeAgent()}>{(row) => <p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><SleepRow row={row()} /></p>}</Show>
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
