import { LAYER } from "@olai/web/client/layer.ts"
import { CLEARANCE } from "olai-plugin-layout/clearance"
import { itemOf, memoryOf, nodeChatTitle, UsageFailure } from "@olai/format"
import { Result } from "effect"
import { type Accessor, batch, createEffect, createMemo, createRoot, createSignal, onCleanup, Show } from "solid-js"
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
import { ChatBeside, useBeside } from "./ChatBeside.tsx"

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
  const reading = agentReadings()!
  let alive = true
  const waits = new Set<() => void>()
  onCleanup(() => { alive = false; for (const stop of [...waits]) stop() })
  const { pair, chat } = createNodeConversation(() => node)
  // THE CHAT'S UNSENT WORDS are the activation's, not this session's
  // (`./reading.ts`'s `unsent`): a seat is taken down and put back whenever one
  // roster frame cannot read the chat on its note, and a start waiting at a
  // sign-in spends several, so words held here would die with the session.
  const draft = () => reading.unsent({ kind: "row", node })
  const setDraft = (text: string) => reading.setUnsent({ kind: "row", node }, text)
  /** Words put in front of what the box already holds. */
  const before = (words: string) => setDraft(draft() === "" ? words : `${words}\n${draft()}`)
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  // THE WORDS GO INTO THE CONVERSATION the moment there is one to put them in
  // — the plain composer's unsent draft, and the words a door's start left for
  // this row when it stopped at a sign-in (`./send-about.ts`'s `sendAbout`).
  //
  // INTO THE CHAT'S OWN MEMORY (`value.ui`), and not before it is OPEN. A
  // start held at a sign-in has a conversation that could not be opened: its
  // row names no session, nobody is reading it, and the UI that answers for
  // that pair is evicted the moment the sign-in replaces it
  // (`./reading.ts`'s `belongs`). Words moved into that one are words the
  // composer that finally opens never sees.
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
          before(text)
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
  return { chat, draft, setDraft, starting, failure, start }
}

/** The page session of a chat row, held for the pane this is drawn in — a
 *  node's or note's own page, and the chat's own page
 *  (`./ChatPage.tsx`). */
export function usePage(node: Accessor<string>) {
  const pane = usePane()
  return createMemo(() => pane === undefined ? undefined : agentReadings()?.page(pane, node(), () => createPageSession(node())))
}

/** The agent line and, under it, what the conversation has standing. The
 * strips are HERE rather than above the transcript because the page's head is
 * what the pane's scroll cannot carry away (`../chat/Strips.tsx`).
 *
 * `own` is the chat's own page saying the line is ITS OWN — handed in by that
 * page (`./ChatPage.tsx`) and by nothing else. A line there draws no *Open
 * beside* of its own (the page's item line above it carries the way back),
 * where every other line offers the conversation beside the item it is drawn
 * under. */
export function PageHead(props: { readonly node: string; readonly own?: boolean }) {
  const beside = useBeside(() => props.node)
  // THE ONE LINE INSTEAD OF THE CONVERSATION, and the page session with it:
  // `<Show>` disposes what it is not drawing, so a page whose chat is in the
  // pane next door holds no lease on it (`./beside.ts`, `./page-owners.ts`).
  return <Show when={beside() === null} fallback={
    <div class="flex items-center gap-2 text-label text-muted" data-testid={TESTID.chatBesideLine} data-agent={props.node}>
      <ChatBeside item={itemOf(props.node)} />
    </div>
  }>
    <PageAgentLine node={props.node} own={props.own} />
  </Show>
}

function PageAgentLine(props: { readonly node: string; readonly own?: boolean }) {
  const page = usePage(() => props.node)
  return <Show when={page()?.chat()} fallback={<AgentAbove node={props.node} line />}>{current =>
    <div data-testid={TESTID.agentPageHead} data-agent={props.node}>
      <AgentLine chat={current()} node={props.node} page own={props.own} />
      <Show when={page()?.chat()} keyed>{chat => <ConversationUIProvider value={chat.ui}>
        <Strips chat={chat} />
      </ConversationUIProvider>}</Show>
    </div>
  }</Show>
}

/** The conversation itself — drawn where the head says it is, and nowhere
 *  else: with a pane on this chat the head carries the whole of what this
 *  page says about it, so there is no second line here to press. */
export function PageFoot(props: { readonly node: string }) {
  const beside = useBeside(() => props.node)
  return <Show when={beside() === null}><PageConversation node={props.node} /></Show>
}

function PageConversation(props: { readonly node: string }) {
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
  const metadata = () => {
    const page = pane === undefined ? undefined : pageReadings()?.at(pane.id)?.shows
    return page?.kind === "node" && page.zoomed.kind === "node" && page.zoomed.shows.node.id === props.node
      // THE ROW'S TITLE, BY THE CHAT'S OWN NAMING RULE: a row written as one
      // markdown link is called by its label wherever a chat is named, and
      // `Ask about [plan](/notes/plan.md)…` is the raw text of a title
      // nobody wrote to be read aloud (`@olai/format`'s `nodeChatTitle`, the
      // rule the roster titles a row with).
      ? { title: nodeChatTitle(page.zoomed.shows.node.title), memory: page.zoomed.under } : null
  }
  return <Show when={metadata()}>{node =>
    <AskBox name={node().title} draft={props.page.draft} setDraft={props.page.setDraft}
      starting={props.page.starting} failure={props.page.failure}
      send={engine => void props.page.start(engine)}
      fixed={agents.at(props.node)?.engine}
      note={<>Sending starts an agent here · Memory: {memoryOf(node())}</>}
      testid={TESTID.agentPlainComposer}
      class={`sticky bottom-0 ${LAYER.row} rounded-control border border-dashed border-rule bg-paper p-3 ${CLEARANCE}`} />
  }</Show>
}
