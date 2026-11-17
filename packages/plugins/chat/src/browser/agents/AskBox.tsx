/**
 * *ASK ABOUT …* — THE ONE BOX that starts a conversation: on a row's own page,
 * and in the seat at the foot of a page and the side panel's **This page**
 * block. What **Send** does is the caller's (start an agent on the row, or a
 * chat about the page); the words, the choice of agent, the key handling and
 * the sentence a refusal leaves are this box's, once.
 *
 * Where no agent can start, the box says why instead — no agent set up, or the
 * row's own engine missing or switched off — so a press is only ever offered
 * when it can work.
 */
import { type Accessor, createSignal, For, type JSX, Show } from "solid-js"
import { composing } from "@olai/web/client/composition.ts"
import { TESTID } from "../../testids.ts"
import { NoAgent } from "../chat/NoAgent.tsx"
import { EngineAbsence } from "./EngineAbsence.tsx"
import { useAgents } from "./answered.tsx"

export function AskBox(props: {
  /** What the box asks about, as a person reads it: *Ask about plan…*. */
  readonly name: string
  readonly draft: Accessor<string>
  readonly setDraft: (text: string) => void
  readonly starting: Accessor<boolean>
  readonly failure: Accessor<string | null>
  /** Send the words to a start on this engine. */
  readonly send: (engine: string) => void
  /** The line under the box: what sending does. */
  readonly note: JSX.Element
  /** An engine the box may not change — a row that already names its own. */
  readonly fixed?: string
  /** The engine to offer first where none is fixed. */
  readonly preferred?: string
  readonly testid: string
  readonly class?: string
  readonly where?: string
}) {
  const agents = useAgents()
  const [chosen, choose] = createSignal<string>()
  const engine = () => props.fixed ?? chosen() ?? props.preferred ?? agents.engines()[0]?.id
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
        {/* `composing` (`@olai/web/client/composition.ts`) because this box is
            drawn by the chat row, which names navigation nowhere — so the
            window-wide guard that keeps an IME's key out of every handler is
            not promised to it. */}
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
