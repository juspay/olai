import { type Accessor, createSignal, For, type JSX, Show } from "solid-js"
import { composing } from "@olai/web/client/composition.ts"
import { TESTID } from "../../testids.ts"
import { NoAgent } from "../chat/NoAgent.tsx"
import { EngineAbsence } from "./EngineAbsence.tsx"
import { useAgents } from "./answered.tsx"

export function AskBox(props: {
  readonly name: string
  readonly draft: Accessor<string>
  readonly setDraft: (text: string) => void
  readonly starting: Accessor<boolean>
  readonly failure: Accessor<string | null>
  readonly send: (engine: string) => void
  readonly note: JSX.Element
  readonly fixed?: string
  readonly testid: string
  readonly class?: string
  readonly where?: string
}) {
  const agents = useAgents()
  const [chosen, choose] = createSignal<string>()
  const engine = () => props.fixed ?? chosen() ?? agents.engines()[0]?.id
  const send = () => { const id = engine(); if (id !== undefined) props.send(id) }
  return (
    <div class={props.class ?? "rounded-control border border-dashed border-rule bg-paper p-3"} data-testid={props.testid} data-where={props.where}>
      <Show when={agents.engines().some(one => one.id === engine())} fallback={
        <Show when={engine()} fallback={<NoAgent />}>{id =>
          <Show when={agents.missing(id())} fallback={
            <p class="m-0 text-body text-muted">This agent isn't turned on. Turn it on in Plugins.</p>
          }>{reason => <EngineAbsence id={id()} missing={reason()} testid={TESTID.chatInstall} />}</Show>
        }</Show>
      }>
        <textarea class="min-h-20 w-full resize-y bg-transparent text-body outline-none" data-testid={TESTID.agentPlainInput}
          aria-label={`Ask about ${props.name}`} placeholder={`Ask about ${props.name}…`}
          value={props.draft()} onInput={event => props.setDraft(event.currentTarget.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (composing(event)) return; send() } }} />
        <div class="flex flex-wrap items-center gap-2 text-label text-muted">
          <select aria-label="Agent" data-testid={TESTID.agentPlainEngine} value={engine()} disabled={props.starting() || props.fixed !== undefined}
            onChange={event => choose(event.currentTarget.value)}>
            <For each={agents.engines()}>{one => <option value={one.id}>{one.name}</option>}</For>
          </select>
          <span class="flex-1" />
          <button type="button" class="rounded-control bg-accent px-3 py-1 font-semibold text-paper" data-testid={TESTID.agentPlainSend} disabled={props.starting()} onClick={send}>
            {props.starting() ? "Starting…" : "Send"}
          </button>
        </div>
        <p class="mb-0 mt-2 text-label text-muted">{props.note}</p>
      </Show>
      <Show when={props.failure()}>{message => <p role="alert" class="mb-0 mt-1 text-label text-alarm" data-testid={TESTID.agentPlainRefused}>{message()}</p>}</Show>
    </div>
  )
}
