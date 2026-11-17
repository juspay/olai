/**
 * THE SEAT, FILLED — what chat draws at the foot of a page that placed one
 * (`olai-plugin-navigation/seat`): the chat about that page, folded or open, or
 * the box that starts one.
 *
 * Which chat is the one reading every face asks (`./answered.tsx`'s `chatAt`),
 * over the place the page said it is.
 *
 * ## The seat is the page's fold
 *
 * Opening a page must never wake its agent: nothing else in olai starts an
 * agent process without a press, and eight may be awake at once. So with a chat
 * there, the seat is FOLDED by default — one line, the agent's mark and how it
 * stands, which reads nothing and wakes nothing — and pressing that line opens
 * it, exactly as a row's fold opens under its row. It also opens when a chat is
 * started from one of the page's doors, and when the chat is opened from
 * **Chats**, **Needs you** or the palette (`./focus.ts`'s `visitAgent`). Open,
 * it draws what a row's fold draws: the agent line, the strips, the
 * conversation and its composer. The choice is remembered for this tab under
 * the chat row's id, the key a row's own fold uses (`./folding.ts`).
 *
 * ## The door
 *
 * With no conversation at the place, the seat draws *Ask about …*. Sending
 * makes a chat row under Inbox › Chats titled `[name](address)`, starts the
 * agent and hands it the words, once, through the server (`./new-chat.ts`'s
 * `about`). A refused start keeps the words in the box and says why; the row
 * it left is the one a retry starts on, so a place never gathers a second one
 * (`../../server/new-chat.ts`). With no agent this machine can start and no
 * chat, there is no door to offer and the seat draws nothing.
 *
 * A seat on screen tells the activation it is there (`./reading.ts`'s `seat`),
 * which is how the side panel's **This page** block and the palette's **Chat
 * about this page** know the page in front has a seat at all.
 */
import { batch, createEffect, createMemo, createSignal, Show, type Accessor } from "solid-js"
import { Dynamic } from "solid-js/web"
import { UsageFailure, placeKey } from "@olai/format"
import { MARK_BOX } from "@olai/ui-primitives/mark.ts"
import type { SeatProps } from "olai-plugin-navigation/contract"
import type { Route } from "olai-plugin-navigation/routes"
import { useRouter } from "olai-plugin-navigation/routing"
import { usePane } from "olai-plugin-navigation/pane"
import { TESTID } from "../../testids.ts"
import { placeMark } from "../kinds.ts"
import { dock } from "../dock.ts"
import { keepMessage } from "../chat/message-draft.ts"
import { ConversationUIProvider } from "../chat/ui.tsx"
import { useAgents } from "./answered.tsx"
import { agentReadings } from "./reading.ts"
import { placeOfRoute } from "./place.ts"
import { usePage } from "./Page.tsx"
import { AgentLine } from "./AgentLine.tsx"
import { Conversation } from "./Fold.tsx"
import { AskBox } from "./AskBox.tsx"
import { AgentStanding } from "./Standing.tsx"
import { unfold, unfolded } from "./folding.ts"
import type { Row } from "./roster.ts"

/** The words under the box, which say what sending does. */
export const ABOUT_NOTE = "Sending starts a chat about this page · it is filed under Inbox › Chats"

/** Whether a chat row has a conversation to read — a session, or an open its
 *  agent stopped at sign-in. A chat row without one is still the place's door:
 *  its start was refused, and the next send starts on it. */
export const talking = (row: Row | undefined): boolean =>
  row !== undefined && (row.session !== null || row.unopened === true)

/** What one press of a door came to: the chat row that now has a conversation
 *  (or is waiting at sign-in), or `null` with the sentence that says why not —
 *  in which case the words stay where they were typed. */
export interface Sent {
  readonly started: string | null
  readonly talking: boolean
  readonly said: string | null
}

/**
 * ONE PRESS OF A DOOR — the seat's box, **This page** and **Chat about this
 * page** all send through here, so a refusal means one thing everywhere.
 *
 *   - nothing created, or a start the agent refused: the words stay in the box
 *     that sent them, and the sentence is shown;
 *   - a start that stopped at sign-in: the chat row exists with no
 *     conversation yet, so the words wait in that row's box (its page session,
 *     which hands them to the conversation once it opens);
 *   - a conversation the first message did not reach: the words wait in its
 *     composer, with the sentence over it.
 *
 * Anything that started opens the seat's fold, so the person sees it.
 */
export const sendAbout = async (input: { readonly about: string; readonly name: string; readonly engine: string; readonly text: string }): Promise<Sent> => {
  const reading = agentReadings()
  if (reading === undefined) return { started: null, talking: false, said: "Chat isn't available" }
  const made = await reading.newChat.about(input)
  if (typeof made === "string") return { started: null, talking: false, said: made }
  if (made.to === null && made.refusal !== null) return { started: null, talking: false, said: made.refusal }
  if (made.to === null) reading.newChat.park(made.node, { engine: input.engine, text: input.text, to: null, refusal: null })
  else if (made.refusal !== null) {
    const ui = reading.ui(made.to)
    keepMessage(ui.messages, JSON.stringify([made.to.agent, made.to.session]), input.text, true)
    ui.refused[1](new UsageFailure({ reason: made.refusal }))
  }
  unfold(made.node)
  return { started: made.node, talking: made.to !== null, said: null }
}

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
      <section class="mt-12" data-testid={TESTID.chatSeat} data-place={placeKey(place())}>
        <header class="mb-3 flex items-center gap-3 text-caption font-semibold uppercase tracking-[0.08em] text-muted">
          <span>Chat about this page</span>
          <span class="h-px flex-1 bg-rule" aria-hidden="true" />
          <Show when={!talking(chat())}><span class="font-normal normal-case tracking-normal">No chat yet</span></Show>
        </header>
        {/* KEYED ON THE CHAT ROW'S ID and not its row: the roster mints fresh
            rows every frame, and a conversation remounted per frame would be
            one re-read per frame. */}
        <Show when={talking(chat()) ? chat()!.id : undefined} keyed fallback={<AboutBox where="seat" place={() => props.place} name={() => props.name}
          started={(sent) => { const door = dock(); if (sent.talking && door?.desktop()) door.open(sent.started) }} />}>
          {(id) => <Show when={unfolded(id)} fallback={<Show when={agents.at(id)}>{(row) => <SeatFolded row={row()} />}</Show>}><SeatChat node={id} /></Show>}
        </Show>
      </section>
    </Show>
  )
}

/** The seat folded: how the chat stands, as the press that opens it. Reads no
 *  conversation, so it wakes no agent. */
function SeatFolded(props: { readonly row: Row }) {
  return <div class="flex items-center gap-2 text-label text-muted" data-testid={TESTID.chatSeatFolded} data-chat={props.row.id}>
    <AgentStanding row={props.row} fold={props.row.id} />
  </div>
}

/** The seat open: the chat row's conversation, through the row page's own
 *  session — which is also where words a sign-in held up are waiting. */
function SeatChat(props: { readonly node: string }) {
  const page = usePage(() => props.node)
  return (
    <Show when={page()?.chat()} keyed fallback={<p class="m-0 py-2 text-label text-muted">Opening…</p>}>
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
 * about it with. Its own draft, which a refused start leaves where it is;
 * `started` is told what came of a press that started something (the side
 * panel docks a conversation; the seat docks one on a desktop).
 */
export function AboutBox(props: {
  readonly where: "seat" | "panel"
  readonly place: Accessor<Route>
  readonly name: Accessor<string>
  readonly started?: (sent: Sent & { readonly started: string }) => void
}) {
  const router = useRouter()
  const [draft, setDraft] = createSignal("")
  const [starting, setStarting] = createSignal(false)
  const [failure, setFailure] = createSignal<string | null>(null)
  const send = async (engine: string) => {
    const text = draft()
    if (starting() || text.trim() === "") return
    batch(() => { setStarting(true); setFailure(null) })
    try {
      const sent = await sendAbout({ about: router.routes.href(props.place()), name: props.name(), engine, text })
      if (sent.started === null) { setFailure(sent.said); return }
      setDraft("")
      props.started?.({ ...sent, started: sent.started })
    } finally { setStarting(false) }
  }
  return <AskBox name={props.name()} draft={draft} setDraft={setDraft} starting={starting} failure={failure}
    send={(engine) => void send(engine)} note={ABOUT_NOTE} testid={TESTID.chatAbout} where={props.where} />
}

/**
 * THE SIDE PANEL'S **This page** BLOCK, over its picker — the same door, beside
 * the page rather than under it, offered exactly where the page in front placed
 * a seat, has no conversation at its place, and an agent can start. Sending
 * docks the new chat, so the conversation that just started is the one beside
 * the page; a refused start leaves whatever was docked alone.
 */
export function ThisPage(props: { readonly open: (node: string) => void }) {
  const agents = useAgents()
  const router = useRouter()
  const seat = createMemo(() => {
    const pane = router.panes()[router.focusIndex()]
    const here = pane === undefined ? undefined : agentReadings()?.seatIn(pane.id)
    if (here === undefined || agents.engines().length === 0) return undefined
    return talking(agents.chatAt(placeOfRoute(router.routes, here.place))) ? undefined : here
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
            <AboutBox where="panel" place={() => here.place} name={() => here.name}
              started={(sent) => { if (sent.talking) props.open(sent.started) }} />
          </section>
        )
      }}
    </Show>
  )
}
