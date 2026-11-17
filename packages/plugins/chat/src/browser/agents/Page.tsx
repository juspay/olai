import { LAYER } from "@olai/web/client/layer.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { memoryOf, UsageFailure } from "@olai/format"
import { Result } from "effect"
import { type Accessor, batch, createEffect, createMemo, createRoot, createSignal, untrack, onCleanup, Show } from "solid-js"
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
import { AgentAbove } from "./AgentAbove.tsx"
import { Strips } from "../chat/Strips.tsx"
import { Conversation } from "./Fold.tsx"
import { AskBox } from "./AskBox.tsx"
import { receive } from "./handoff.ts"

export interface PageSession {
  readonly preferredEngine: Accessor<string | undefined>
  readonly chat: Accessor<Chat | null>
  /** The chat row whose conversation this page draws — the row's own, or a
   *  chat row standing for it. */
  readonly chatRow: Accessor<string>
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
  const chatRow = createMemo(() => reading.agents.chatAt({ kind: "row", id: node })?.id ?? node)
  const { pair, chat } = createNodeConversation(chatRow)
  const [draft, setDraft] = createSignal("")
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  // THE WORDS THIS PAGE IS HOLDING GO INTO ITS CONVERSATION the moment there
  // is one to put them in — the plain composer's unsent draft, and the words
  // a door's start left here when it stopped at a sign-in (`./Seat.tsx`'s
  // `sendAbout` parks them for this row).
  //
  // INTO THE CHAT'S OWN MEMORY (`value.ui`), and not before it is OPEN. A
  // start held at a sign-in has a conversation that could not be opened: its
  // row names no session, nobody is reading it, and the UI that answers for
  // that pair is evicted the moment the sign-in replaces it
  // (`./reading.ts`'s `belongs`). Words moved into that one are words the
  // composer that finally opens never sees — which is where a sign-in used
  // to lose them. Held here instead, they go in when there is somewhere for
  // them to stay.
  createEffect(() => {
    const value = chat()
    const state = value?.state()
    const text = draft()
    const to = pair()
    if (value === null || to === null || state?.talking?.kind !== "agent" || state.unopened != null
      || state.session?.id !== to.session || state.talking.id !== to.agent || text === "") return
    keepMessage(value.ui.messages, JSON.stringify([to.agent, to.session]), text, true)
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
  // ...AND WORDS OUTLIVE THIS SESSION. A seat is taken down and put back for
  // reasons that are nothing to do with the person — one roster frame in
  // which the chat at this place is not yet readable is enough, and a start
  // waiting at a sign-in spends several. A session disposed while it is
  // still holding somebody's words parks them again, so the next session of
  // this node claims them exactly as the first one did.
  onCleanup(() => {
    const text = draft()
    const engine = preferredEngine() ?? reading.agents.at(chatRow())?.engine
    if (text === "" || engine === undefined) return
    reading.newChat.park(node, { engine, text, to: null, refusal: failure() })
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
  return { chat, chatRow, draft, setDraft, starting, failure, start, preferredEngine }
}

/** The page session of a chat row, held for the pane this is drawn in — a
 *  row's own page, and the seat under a page about a place whose chat row has
 *  no conversation yet (`./Seat.tsx`). */
export function usePage(node: Accessor<string>) {
  const pane = usePane()
  return createMemo(() => pane === undefined ? undefined : agentReadings()?.page(pane, node(), () => createPageSession(node())))
}

/** The agent line and, under it, what the conversation has standing. The
 * strips are HERE rather than above the transcript because the page's head is
 * what the pane's scroll cannot carry away (`../chat/Strips.tsx`). */
export function PageHead(props: { readonly node: string }) {
  const page = usePage(() => props.node)
  return <Show when={page()?.chat()} fallback={<AgentAbove node={props.node} line />}>{current =>
    <div data-testid={TESTID.agentPageHead} data-agent={props.node}>
      <AgentLine chat={current()} node={page()!.chatRow()} page />
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
        <ConversationUIProvider value={chat.ui}><Conversation chat={chat} node={owner().chatRow()} page /></ConversationUIProvider>
      }</Show>
    </div>
  }</Show>
}

function PlainComposer(props: { readonly node: string; readonly page: PageSession }) {
  const pane = usePane()
  const agents = useAgents()
  const metadata = () => {
    const page = pane === undefined ? undefined : pageReadings()?.at(pane.id)?.shows
    return page?.kind === "node" && page.zoomed.kind === "node" && page.zoomed.shows.node.id === props.node
      ? { title: page.zoomed.shows.node.title, memory: page.zoomed.under } : null
  }
  return <Show when={metadata()}>{node =>
    <AskBox name={node().title} draft={props.page.draft} setDraft={props.page.setDraft}
      starting={props.page.starting} failure={props.page.failure}
      send={engine => void props.page.start(engine)}
      fixed={agents.chatAt({ kind: "row", id: props.node })?.engine} preferred={props.page.preferredEngine()}
      note={<>Sending starts an agent here · Memory: {memoryOf(node())}</>}
      testid={TESTID.agentPlainComposer}
      class={`sticky bottom-0 ${LAYER.row} rounded-control border border-dashed border-rule bg-paper p-3 ${CLEARANCE}`} />
  }</Show>
}
