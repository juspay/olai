/**
 * THE SEAT, FILLED — what chat draws at the foot of a page that placed one
 * (`olai-plugin-navigation/seat`): the conversation about that page, or the box
 * that starts one.
 *
 * Which conversation is the one reading every face asks
 * (`./answered.tsx`'s `chatAt`), over the place the page said it is. With one,
 * the seat draws the pieces a row's fold draws — the agent line, the strips,
 * the conversation and its composer. With none, it draws *Ask about …*:
 * sending makes a chat row under Inbox › Chats titled `[name](address)`,
 * starts the agent on it and hands it the words, once (`./new-chat.ts`'s
 * `about`). With no agent this machine can start, there is no door to offer
 * and the seat draws nothing.
 *
 * A seat on screen tells the activation it is there (`./reading.ts`'s `seat`),
 * which is how the side panel's **This page** block and the palette's **Chat
 * about this page** know the page in front has a seat at all.
 */
import { batch, createEffect, createMemo, createSignal, For, Show, type Accessor } from "solid-js"
import { Dynamic } from "solid-js/web"
import { placeMark } from "../kinds.ts"
import { dock } from "../dock.ts"
import { placeKey } from "@olai/format"
import type { SeatProps } from "olai-plugin-navigation/contract"
import type { Route } from "olai-plugin-navigation/routes"
import { useRouter } from "olai-plugin-navigation/routing"
import { usePane } from "olai-plugin-navigation/pane"
import { composing } from "@olai/web/client/composition.ts"
import { TESTID } from "../../testids.ts"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { placeOfRoute } from "./place.ts"
import { usePage } from "./Page.tsx"
import { AgentLine } from "./AgentLine.tsx"
import { Conversation } from "./Fold.tsx"
import { MARK_BOX } from "./ChatName.tsx"

/** The words under the box, which say what sending does. */
export const ABOUT_NOTE = "Sending starts a chat about this page · it is filed under Inbox › Chats"

export function ChatSeat(props: SeatProps) {
  const agents = useAgents()
  const router = useRouter()
  const pane = usePane()
  const place = createMemo(() => placeOfRoute(router.routes, props.place))
  const chat = createMemo(() => agents.chatAt(place()))
  // REGISTERED FROM AN EFFECT, AS VALUES: the side panel and the palette read
  // this from outside the page, and a closure over this page's props would let
  // them read a page that is being left (Solid's stale-accessor error). An
  // effect never runs for a disposed page, and re-registers when the page says
  // it is a different place.
  createEffect(() => {
    const reading = agentReadings()
    if (pane !== undefined) reading?.seat({ pane: pane.id, place: props.place, name: props.name })
  })
  return (
    <Show when={chat() !== undefined || agents.engines().length > 0}>
      <section class="mt-12" data-testid={TESTID.chatSeat} data-place={placeKey(place())} id="seat">
        <header class="mb-3 flex items-center gap-3 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
          <span>Chat about this page</span>
          <span class="h-px flex-1 bg-rule" aria-hidden="true" />
          <Show when={chat() === undefined}><span class="font-normal normal-case tracking-normal">No chat yet</span></Show>
        </header>
        <Show when={chat()?.id} keyed fallback={<AboutBox where="seat" place={() => props.place} name={() => props.name}
          started={(node) => { const door = dock(); if (door?.desktop()) door.open(node) }} />}>
          {(id) => <SeatChat node={id} name={props.name} />}
        </Show>
      </section>
    </Show>
  )
}

/** A chat row's conversation in the seat — or, where it has none yet (its start
 *  was refused, or a hand-typed row names only an engine), the box that starts
 *  one on THAT row, through the row page's own session. */
function SeatChat(props: { readonly node: string; readonly name: string }) {
  const page = usePage(() => props.node)
  return (
    <Show when={page()?.chat()} keyed fallback={
      <Show when={page()}>{(session) => <AskBox where="seat" name={props.name}
        draft={session().draft} setDraft={session().setDraft} starting={session().starting} failure={session().failure}
        send={(engine) => void session().start(engine)} />}</Show>
    }>
      {(chat) => (
        <div class="rounded-surface border border-rule bg-panel shadow-raised" data-chat={props.node}>
          <AgentLine chat={chat} node={props.node} />
          <ConversationUIProvider value={chat.ui}><Conversation chat={chat} node={props.node} /></ConversationUIProvider>
        </div>
      )}
    </Show>
  )
}

/**
 * THE DOOR, as a box: a page's place and name, and the words to start a chat
 * about it with. Its own draft, which survives the person pressing Send while
 * the agent is refused; `started` is told the new chat row once there is one
 * (the side panel docks it).
 */
export function AboutBox(props: {
  readonly where: "seat" | "panel"
  readonly place: Accessor<Route>
  readonly name: Accessor<string>
  readonly started?: (node: string) => void
}) {
  const router = useRouter()
  const [draft, setDraft] = createSignal("")
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  const send = async (engine: string) => {
    const reading = agentReadings()
    const text = draft()
    if (reading === undefined || starting() || text.trim() === "") return
    batch(() => { setStarting(true); setFailure(null) })
    try {
      const made = await reading.newChat.about({ about: router.routes.href(props.place()), name: props.name(), engine, text })
      if (typeof made === "string") { setFailure(made); return }
      setDraft("")
      if (made.refusal !== null) setFailure(made.refusal)
      props.started?.(made.node)
    } finally { setStarting(false) }
  }
  return <AskBox where={props.where} name={props.name()} draft={draft} setDraft={setDraft} starting={starting} failure={failure}
    send={(engine) => void send(engine)} />
}

/** The box itself: what to say, which agent, and Send. */
function AskBox(props: {
  readonly where: "seat" | "panel"
  readonly name: string
  readonly draft: Accessor<string>
  readonly setDraft: (text: string) => void
  readonly starting: Accessor<boolean>
  readonly failure: Accessor<string | null>
  readonly send: (engine: string) => void
}) {
  const agents = useAgents()
  const [chosen, choose] = createSignal<string>()
  const engine = () => chosen() ?? agents.engines()[0]?.id
  const send = () => { const id = engine(); if (id !== undefined) props.send(id) }
  return (
    <div class="rounded-control border border-dashed border-rule bg-paper p-3" data-testid={TESTID.chatAbout} data-where={props.where}>
      {/* `composing`, because a page drawn by another row promises this box
          nothing about the window-wide guard that keeps an IME's key out. */}
      <textarea class="min-h-20 w-full resize-y bg-transparent text-body outline-none" data-testid={TESTID.chatAboutInput}
        aria-label={`Ask about ${props.name}`} placeholder={`Ask about ${props.name}…`}
        value={props.draft()} onInput={(event) => props.setDraft(event.currentTarget.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (composing(event)) return; send() } }} />
      <div class="flex flex-wrap items-center gap-2 text-label text-muted">
        <select aria-label="Agent" data-testid={TESTID.chatAboutEngine} value={engine()} disabled={props.starting()}
          onChange={(event) => choose(event.currentTarget.value)}>
          <For each={agents.engines()}>{(one) => <option value={one.id}>{one.name}</option>}</For>
        </select>
        <span class="flex-1" />
        <button type="button" class="rounded-control bg-accent px-3 py-1 font-semibold text-paper" data-testid={TESTID.chatAboutSend}
          disabled={props.starting()} onClick={send}>
          {props.starting() ? "Starting…" : "Send"}
        </button>
      </div>
      <p class="mb-0 mt-2 text-label text-muted">{ABOUT_NOTE}</p>
      <Show when={props.failure()}>{(message) => <p role="alert" class="mb-0 mt-1 text-label text-alarm" data-testid={TESTID.chatAboutRefused}>{message()}</p>}</Show>
    </div>
  )
}

/**
 * THE SIDE PANEL'S **This page** BLOCK, over its picker — the same door, beside
 * the page rather than under it, offered exactly where the page in front placed
 * a seat, has no chat at its place, and an agent can start. Sending docks the
 * new chat, so the conversation that just started is the one beside the page.
 */
export function ThisPage(props: { readonly open: (node: string) => void }) {
  const agents = useAgents()
  const router = useRouter()
  const seat = createMemo(() => {
    const pane = router.panes()[router.focusIndex()]
    const here = pane === undefined ? undefined : agentReadings()?.seatIn(pane.id)
    if (here === undefined || agents.engines().length === 0) return undefined
    return agents.chatAt(placeOfRoute(router.routes, here.place)) === undefined ? here : undefined
  })
  return (
    <Show when={seat()} keyed>
      {(here) => {
        const place = () => placeOfRoute(router.routes, here.place)
        const mark = () => placeMark(router.routes, place())
        return (
          <section class="mb-2 px-1" data-testid={TESTID.chatThisPage} data-place={placeKey(place())}>
            <p class="m-0 px-2 pb-1 pt-2 text-caption font-semibold uppercase tracking-[0.08em] text-muted">This page</p>
            <p class="m-0 flex items-baseline gap-2 px-2 pb-2 text-body">
              <Show when={mark()}>{(drawn) => <span class={`${MARK_BOX} self-center text-muted`}><Dynamic component={drawn()} /></span>}</Show>
              <span class="min-w-0 truncate">{here.name}</span>
              <span class="min-w-0 flex-1 truncate font-mono text-caption text-muted">{router.routes.href(here.place).replace(/^\//, "")}</span>
              <span class="shrink-0 text-caption text-muted">No chat yet</span>
            </p>
            <AboutBox where="panel" place={() => here.place} name={() => here.name} started={props.open} />
          </section>
        )
      }}
    </Show>
  )
}
