import { LAYER } from "@olai/web/client/layer.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { memoryOf, UsageFailure } from "@olai/format"
import { Result } from "effect"
import { type Accessor, batch, createEffect, createMemo, createRoot, createSignal, untrack, For, onCleanup, Show } from "solid-js"
import { usePane } from "olai-plugin-navigation/pane"
import { runAsync } from "@olai/web/client/run.ts"
import { TESTID } from "../../testids.ts"
import type { Conversing } from "../../sessions.ts"
import { type Chat } from "../chat/state.ts"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { keepMessage } from "../chat/message-draft.ts"
import { pageReadings } from "../pages.ts"
import { chatWire } from "../wire.ts"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { createNodeConversation } from "./conversation.ts"
import { AgentLine } from "./AgentLine.tsx"
import { Strips } from "../chat/Strips.tsx"
import { Conversation } from "./Fold.tsx"
import { NoAgent } from "../chat/NoAgent.tsx"
import { EngineAbsence } from "./EngineAbsence.tsx"
import { receive } from "./handoff.ts"

export interface PageSession {
  readonly preferredEngine: Accessor<string | undefined>
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
  const reading = agentReadings()!
  let alive = true
  const waits = new Set<() => void>()
  onCleanup(() => { alive = false; for (const stop of [...waits]) stop() })
  const { pair, chat } = createNodeConversation(() => node)
  const [draft, setDraft] = createSignal("")
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  createEffect(() => {
    const value = chat()
    const state = value?.state()
    const text = draft()
    const to = pair()
    if (value === null || to === null || state?.talking?.kind !== "agent"
      || state.session?.id !== to.session || state.talking.id !== to.agent || text === "") return
    keepMessage(reading.ui(to).messages, JSON.stringify([to.agent, to.session]), text, true)
    setDraft("")
  })
  const ready = (to: Conversing): Promise<Chat | null> => new Promise(resolve => {
    if (!alive) { resolve(null); return }
    createRoot(dispose => {
      const stop = () => { waits.delete(stop); dispose(); resolve(null) }
      waits.add(stop)
      createEffect(() => {
        const value = chat()
        if (value === null) return
        const now = pair()
        waits.delete(stop)
        dispose()
        resolve(same(now, to) ? value : null)
      })
    })
  })
  const deliver = async (to: Conversing, text: string, later: string) => {
    const ui = reading.ui(to)
    // The send is work that keeps this conversation's UI, whoever is reading.
    const releaseUI = reading.retainUI(ui)
    try {
      const key = JSON.stringify([to.agent, to.session])
      keepMessage(ui.messages, key, later)
      const value = await ready(to)
      if (value === null) {
        ui.refused[1](new UsageFailure({ reason: "The chat changed, so this didn't happen. Try again." }))
        keepMessage(ui.messages, key, text, true)
      } else if (!await value.send(text, [], [])) keepMessage(ui.messages, key, text, true)
    } finally { releaseUI() }
  }
  const [preferredEngine, prefer] = createSignal<string>()
  createEffect(() => {
    const arrival = reading.newChat.take(node)
    if (arrival === undefined) return
    untrack(() => receive(arrival, {
      prefer,
      refuse: setFailure,
      redraft: words => setDraft(now => now === "" ? words : `${words}\n${now}`),
      deliver: (to, text) => {
        setStarting(true)
        return deliver(to, text, "").finally(() => setStarting(false))
      },
    }))
  })
  const start = async (engine: string) => {
    const text = draft()
    if (starting() || text.trim() === "") return
    batch(() => { setStarting(true); setFailure(null); setDraft("") })
    try {
      const result = await runAsync(chatWire().procedures.conversation.startAgentSession({ node, agent: engine }))
      if (agentReadings() !== reading) return
      if (Result.isFailure(result)) {
        // After the await: the words and the refusal appear together.
        batch(() => {
          setDraft(now => now === "" ? text : `${text}\n${now}`)
          setFailure(result.failure.message)
        })
        return
      }
      const to = result.success
      if (to === null) { setDraft(text); return }
      const later = draft()
      setDraft("")
      await deliver(to, text, later)
    } finally { setStarting(false) }
  }
  return { chat, draft, setDraft, starting, failure, start, preferredEngine }
}

function usePage(node: Accessor<string>) {
  const pane = usePane()
  return createMemo(() => pane === undefined ? undefined : agentReadings()?.page(pane, node(), () => createPageSession(node())))
}

/** The agent line and, under it, what the conversation has standing. The
 * strips are HERE rather than above the transcript because the page's head is
 * what the pane's scroll cannot carry away (`../chat/Strips.tsx`). */
export function PageHead(props: { readonly node: string }) {
  const page = usePage(() => props.node)
  return <Show when={page()?.chat()}>{current =>
    <div data-testid={TESTID.agentPageHead} data-agent={props.node}>
      <AgentLine chat={current()} node={props.node} page />
      <Show when={page()?.chat()} keyed>{chat => <ConversationUIProvider value={chat.ui}>
        <Strips chat={chat} />
      </ConversationUIProvider>}</Show>
    </div>
  }</Show>
}

export function PageFoot(props: { readonly node: string }) {
  const page = usePage(() => props.node)
  return <Show when={page()}>{owner =>
    <div class="mt-6" data-testid={TESTID.agentPageFoot} data-agent={props.node}>
      <Show when={owner().chat()} keyed fallback={<PlainComposer node={props.node} page={owner()} />}>{chat =>
        <ConversationUIProvider value={chat.ui}><Conversation chat={chat} node={props.node} page /></ConversationUIProvider>
      }</Show>
    </div>
  }</Show>
}

function PlainComposer(props: { readonly node: string; readonly page: PageSession }) {
  const pane = usePane()
  const agents = useAgents()
  const [chosen, choose] = createSignal<string>()
  const engine = () => agents.at(props.node)?.engine ?? chosen() ?? props.page.preferredEngine() ?? agents.engines()[0]?.id
  const missing = () => agents.missing(engine())
  const metadata = () => {
    const page = pane === undefined ? undefined : pageReadings()?.at(pane.id)?.shows
    return page?.kind === "node" && page.zoomed.kind === "node" && page.zoomed.shows.node.id === props.node
      ? { title: page.zoomed.shows.node.title, memory: page.zoomed.under } : null
  }
  const send = () => { const id = engine(); if (id !== undefined) void props.page.start(id) }
  return <Show when={metadata()}>{node =>
    <div class={`sticky bottom-0 ${LAYER.row} rounded-control border border-dashed border-rule bg-paper p-3 ${CLEARANCE}`} data-testid={TESTID.agentPlainComposer}>
      <Show when={agents.engines().some(one => one.id === engine())} fallback={
        <Show when={engine()} fallback={<NoAgent />}>{id =>
          <Show when={missing()} fallback={
            <p class="m-0 text-body text-muted">This agent isn't turned on. Turn it on in Plugins.</p>
          }>{reason => <EngineAbsence id={id()} missing={reason()} testid={TESTID.chatInstall} />}</Show>
        }</Show>
      }>
        <textarea class="min-h-20 w-full resize-y bg-transparent text-body outline-none" data-testid={TESTID.agentPlainInput}
          aria-label={`Ask about ${node().title}`} placeholder={`Ask about ${node().title}…`}
          value={props.page.draft()} onInput={event => props.page.setDraft(event.currentTarget.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); send() } }} />
        <div class="flex flex-wrap items-center gap-2 text-label text-muted">
          <select aria-label="Agent" data-testid={TESTID.agentPlainEngine} value={engine()} disabled={props.page.starting() || agents.at(props.node) !== undefined}
            onChange={event => choose(event.currentTarget.value)}>
            <For each={agents.engines()}>{one => <option value={one.id}>{one.name}</option>}</For>
          </select>
          <span class="flex-1" />
          <button type="button" class="rounded-control bg-accent px-3 py-1 font-semibold text-paper" data-testid={TESTID.agentPlainSend} disabled={props.page.starting()} onClick={send}>
            {props.page.starting() ? "Starting…" : "Send"}
          </button>
        </div>
        <p class="mb-0 mt-2 text-label text-muted">Sending starts an agent here · Memory: {memoryOf(node())}</p>
      </Show>
      <Show when={props.page.failure()}>{message => <p role="alert" class="mb-0 text-label text-alarm">{message()}</p>}</Show>
    </div>
  }</Show>
}
