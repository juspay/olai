import { memoryOf, UsageFailure } from "@olai/format"
import { Result } from "effect"
import { type Accessor, createEffect, createMemo, createRoot, createSignal, For, onCleanup, Show } from "solid-js"
import { usePane } from "olai-plugin-navigation/pane"
import { runAsync } from "@olai/web/client/run.ts"
import { TESTID } from "../../testids.ts"
import type { Conversing } from "../../sessions.ts"
import { createChat, type Chat } from "../chat/state.ts"
import { createAsked } from "../chat/attention/asked.ts"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { keepMessage } from "../chat/message-draft.ts"
import { pageReadings } from "../pages.ts"
import { chatWire } from "../wire.ts"
import { useAgents } from "./answered.tsx"
import { agentReadings, readAgent } from "./reading.ts"
import { AgentLine } from "./AgentLine.tsx"
import { Conversation } from "./Fold.tsx"

export interface PageSession {
  readonly chat: Accessor<Chat | null>
  readonly draft: Accessor<string>
  readonly setDraft: (text: string) => void
  readonly starting: Accessor<boolean>
  readonly failure: Accessor<string | null>
  readonly start: (engine: string) => Promise<void>
}
const same = (a: Conversing | null | undefined, b: Conversing | null | undefined) =>
  a?.agent === b?.agent && a?.session === b?.session

/** The opening gesture belongs to the page, so replacing its plain composer
 * with the conversation cannot dispose the message waiting for that open. */
function createPageSession(node: string): PageSession {
  const agents = useAgents()
  const reading = agentReadings()!
  let alive = true
  const waits = new Set<() => void>()
  onCleanup(() => { alive = false; for (const stop of [...waits]) stop() })
  const pair = createMemo(() => {
    const agent = agents.at(node)
    return agent?.session == null ? null : reading.visiting(node) ?? { agent: agent.engine, session: agent.session }
  }, null, { equals: same })
  const chat = createMemo(() => {
    const to = pair()
    if (to === null) return null
    const value = createChat(to, { ui: reading.ui(to), visit: to => reading.visit(node, to) })
    readAgent(node, value)
    const question = createAsked(value)
    createEffect(() => value.ui.question[1](question()))
    return value
  })
  const [draft, setDraft] = createSignal("")
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  const ready = (to: Conversing): Promise<Chat | null> => new Promise(resolve => {
    if (!alive) { resolve(null); return }
    createRoot(dispose => {
      const stop = () => { waits.delete(stop); dispose(); resolve(null) }
      waits.add(stop)
      createEffect(() => {
        const now = pair()
        if (now === null) return
        const value = chat()
        waits.delete(stop)
        dispose()
        resolve(same(now, to) ? value : null)
      })
    })
  })
  const start = async (engine: string) => {
    const text = draft()
    if (starting() || text.trim() === "") return
    setStarting(true)
    setFailure(null)
    setDraft("")
    try {
      const result = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine }))
      if (agentReadings() !== reading) return
      if (Result.isFailure(result)) {
        setDraft(now => now === "" ? text : `${text}\n${now}`)
        setFailure(result.failure.message)
        return
      }
      const to = result.success
      const ui = reading.ui(to)
      const key = JSON.stringify([to.agent, to.session])
      // Preserve words typed after the first send as an ordinary unsent draft.
      keepMessage(ui.messages, key, draft())
      setDraft("")
      const value = await ready(to)
      if (value === null) {
        ui.refused[1](new UsageFailure({ reason: "the conversation changed; this action was not applied" }))
        keepMessage(ui.messages, key, text, true)
      } else if (!await value.send(text, [], [])) {
        keepMessage(ui.messages, key, text, true)
      }
    } finally { setStarting(false) }
  }
  return { chat, draft, setDraft, starting, failure, start }
}

function usePage(node: Accessor<string>) {
  const pane = usePane()
  return createMemo(() => pane === undefined ? undefined : agentReadings()?.page(pane, node(), () => createPageSession(node())))
}

export function PageHead(props: { readonly node: string }) {
  const page = usePage(() => props.node)
  return <Show when={page()?.chat()} keyed>{chat =>
    <ConversationUIProvider value={chat.ui}>
      <div data-testid={TESTID.agentPageHead} data-agent={props.node}><AgentLine chat={chat} node={props.node} page /></div>
    </ConversationUIProvider>
  }</Show>
}

export function PageFoot(props: { readonly node: string }) {
  const page = usePage(() => props.node)
  return <Show when={page()}>{owner =>
    <div class="mt-6" data-testid={TESTID.agentPageFoot} data-agent={props.node}>
      <Show when={owner().chat()} keyed fallback={<PlainComposer node={props.node} page={owner()} />}>{chat =>
        <ConversationUIProvider value={chat.ui}><Conversation chat={chat} node={props.node} unbounded /></ConversationUIProvider>
      }</Show>
    </div>
  }</Show>
}

function PlainComposer(props: { readonly node: string; readonly page: PageSession }) {
  const pane = usePane()
  const agents = useAgents()
  const [chosen, choose] = createSignal<string>()
  const engine = () => agents.at(props.node)?.engine ?? chosen() ?? agents.engines()[0]?.id
  const metadata = () => {
    const page = pane === undefined ? undefined : pageReadings()?.at(pane.index)?.shows
    return page?.kind === "node" && page.zoomed.kind === "node" && page.zoomed.shows.node.id === props.node
      ? { title: page.zoomed.shows.node.title, memory: page.zoomed.under } : null
  }
  const send = () => { const id = engine(); if (id !== undefined) void props.page.start(id) }
  return <Show when={metadata()}>{node =>
    <div class="rounded border border-dashed border-rule p-3" data-testid={TESTID.agentPlainComposer}>
      <Show when={agents.engines().some(one => one.id === engine())} fallback={<p class="m-0 text-xs text-muted">No agent engine is available.</p>}>
        <textarea class="min-h-20 w-full resize-y bg-transparent text-sm outline-none" data-testid={TESTID.agentPlainInput}
          aria-label={`ask about ${node().title}`} placeholder={`ask about ${node().title}…`}
          value={props.page.draft()} onInput={event => props.page.setDraft(event.currentTarget.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); send() } }} />
        <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
          <select aria-label="Agent engine" data-testid={TESTID.agentPlainEngine} value={engine()} disabled={props.page.starting() || agents.at(props.node) !== undefined}
            onChange={event => choose(event.currentTarget.value)}>
            <For each={agents.engines()}>{one => <option value={one.id}>{one.name}</option>}</For>
          </select>
          <span class="flex-1" />
          <button type="button" class="rounded bg-accent px-3 py-1 font-semibold text-paper" data-testid={TESTID.agentPlainSend} disabled={props.page.starting()} onClick={send}>
            {props.page.starting() ? "starting…" : "send"}
          </button>
        </div>
        <p class="mb-0 mt-2 font-mono text-xs text-muted">sending starts this node's agent · memory: this subtree ({memoryOf(node())})</p>
      </Show>
      <Show when={props.page.failure()}>{message => <p role="alert" class="mb-0 text-xs text-alarm">{message()}</p>}</Show>
    </div>
  }</Show>
}
